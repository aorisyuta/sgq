#!/usr/bin/env python3
"""UniBoard SPICE の Android APK を組み立てる (Android SDK なし)

必要なもの (Maven Central から取得):
  android-all.jar  … org.robolectric:android-all:14-robolectric-10818077 (コンパイル用の Android API)
  dx.jar           … com.jakewharton.android.repackaged:dalvik-dx:16.0.1 (class → dex)
  apksig.jar       … com.android.tools.build:apksig:2.3.0 (APK 署名 v1 + v2)
使い方: python3 android/build.py  →  dist/UniBoardSPICE.apk
"""
import os, sys, struct, subprocess, zipfile, shutil, io, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SDK = os.environ.get('UB_ANDROID_TOOLS', os.path.join(os.path.dirname(ROOT), 'android-sdk'))
OUT = os.path.join(ROOT, 'dist')
WORK = os.path.join(HERE, 'build')
PKG = 'jp.uniboard.spice'
VERSION_CODE, VERSION_NAME = 1, '2026.09.27'
LABEL = 'UniBoard SPICE'
MIN_SDK, TARGET_SDK = 24, 34
MAVEN = 'https://repo1.maven.org/maven2/'
DEPS = {
    'android-all.jar': 'org/robolectric/android-all/14-robolectric-10818077/android-all-14-robolectric-10818077.jar',
    'dx.jar': 'com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar',
    'apksig.jar': 'com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar',
}

def sh(*a):
    r = subprocess.run(a, capture_output=True, text=True)
    out = '\n'.join(l for l in (r.stdout + r.stderr).splitlines() if 'JAVA_TOOL_OPTIONS' not in l and not l.startswith('Note:'))
    if r.returncode: sys.exit('失敗: ' + ' '.join(a) + '\n' + out)
    return out

# ---------------- バイナリ XML (AndroidManifest.xml) ----------------
ANDROID_NS = 'http://schemas.android.com/apk/res/android'
ATTR_ID = {  # android: 属性のリソース ID
    'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003, 'exported': 0x01010010, 'screenOrientation': 0x0101001e,
    'configChanges': 0x0101001f, 'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b, 'versionName': 0x0101021c,
    'windowSoftInputMode': 0x0101022b, 'targetSdkVersion': 0x01010270, 'allowBackup': 0x01010280,
    'hardwareAccelerated': 0x010102d3, 'largeHeap': 0x0101035a, 'roundIcon': 0x0101052c, 'compileSdkVersion': 0x01010572,
}
T_REF, T_STR, T_INT, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12

def string_pool(strings, utf8=True):
    offs, data = [], bytearray()
    for s in strings:
        offs.append(len(data))
        b = s.encode('utf-8')
        def ln(n):
            return bytes([n]) if n < 0x80 else bytes([0x80 | (n >> 8), n & 0xff])
        data += ln(len(s)) + ln(len(b)) + b + b'\x00'
    while len(data) % 4: data += b'\x00'
    hdr = 28
    start = hdr + 4 * len(strings)
    body = b''.join(struct.pack('<I', o) for o in offs) + bytes(data)
    return struct.pack('<HHIIIIII', 0x0001, hdr, hdr + len(body), len(strings), 0, 0x100 if utf8 else 0, start, 0) + body

def axml(tree):
    """tree: (tag, [(ns, name, type, value)], [children])"""
    # 文字列: まずリソース ID つき属性名 (ID 順)、その後その他
    attr_names = []
    def walk(n):
        for ns, name, t, v in n[1]:
            if ns and name not in attr_names: attr_names.append(name)
        for c in n[2]: walk(c)
    walk(tree)
    attr_names.sort(key=lambda n: ATTR_ID[n])
    strings = list(attr_names)
    def si(s):
        if s not in strings: strings.append(s)
        return strings.index(s)
    for s in ['android', ANDROID_NS]: si(s)
    chunks = []
    def elem(n):
        tag, attrs, kids = n
        # 並び: 名前空間なし → android (リソース ID 順)
        attrs = sorted(attrs, key=lambda a: (1 if a[0] else 0, ATTR_ID.get(a[1], 0), a[1]))
        ab = b''
        for ns, name, t, v in attrs:
            nsi = si(ANDROID_NS) if ns else 0xFFFFFFFF
            if t == T_STR:
                raw = si(v); data = raw
            else:
                raw = 0xFFFFFFFF; data = v & 0xFFFFFFFF
            ab += struct.pack('<IIIHBBI', nsi, si(name), raw, 8, 0, t, data)
        body = struct.pack('<IIHHHHHH', 0xFFFFFFFF, si(tag), 20, 20, len(attrs), 0, 0, 0) + ab
        chunks.append(struct.pack('<HHIII', 0x0102, 16, 16 + len(body), 1, 0xFFFFFFFF) + body)
        for k in kids: elem(k)
        chunks.append(struct.pack('<HHIIIII', 0x0103, 16, 24, 1, 0xFFFFFFFF, 0xFFFFFFFF, si(tag)))
    ns_start = struct.pack('<HHIIIII', 0x0100, 16, 24, 1, 0xFFFFFFFF, si('android'), si(ANDROID_NS))
    elem(tree)
    ns_end = struct.pack('<HHIIIII', 0x0101, 16, 24, 1, 0xFFFFFFFF, si('android'), si(ANDROID_NS))
    pool = string_pool(strings)
    resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(attr_names)) + b''.join(struct.pack('<I', ATTR_ID[n]) for n in attr_names)
    body = pool + resmap + ns_start + b''.join(chunks) + ns_end
    return struct.pack('<HHI', 0x0003, 8, 8 + len(body)) + body

# ---------------- resources.arsc (ランチャーアイコンのみ) ----------------
DENS = [('mdpi', 160, 48), ('hdpi', 240, 72), ('xhdpi', 320, 96), ('xxhdpi', 480, 144), ('xxxhdpi', 640, 192)]
def arsc():
    paths = ['res/mipmap-%s-v4/ic_launcher.png' % d for d, _, _ in DENS]
    gpool = string_pool(paths)
    types = string_pool(['mipmap'])
    keys = string_pool(['ic_launcher'])
    spec = struct.pack('<HHIBBHI', 0x0202, 16, 16 + 4, 1, 0, 0, 1) + struct.pack('<I', 0x0100)  # density で変わる
    tchunks = b''
    for i, (d, dpi, _) in enumerate(DENS):
        cfg = bytearray(64); struct.pack_into('<I', cfg, 0, 64); struct.pack_into('<H', cfg, 14, dpi); struct.pack_into('<H', cfg, 24, 4)
        hdr = 20 + 64
        entry = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STR, i)
        body = struct.pack('<I', 0) + entry
        tchunks += struct.pack('<HHIBBHII', 0x0201, hdr, hdr + len(body), 1, 0, 0, 1, hdr + 4) + bytes(cfg) + body
    name = PKG.encode('utf-16-le').ljust(256, b'\x00')
    phdr = 288
    pbody = types + keys + spec + tchunks
    pkg = struct.pack('<HHII', 0x0200, phdr, phdr + len(pbody), 0x7f) + name + struct.pack('<IIIII', phdr, 1, phdr + len(types), 1, 0) + pbody
    body = gpool + pkg
    return struct.pack('<HHII', 0x0002, 12, 12 + len(body), 1) + body

# ---------------- アイコン ----------------
def icon_png(px):
    from PIL import Image, ImageDraw
    S = px * 4
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = S * 0.06
    d.rounded_rectangle([m, m, S - m, S - m], radius=S * 0.24, fill=(10, 122, 98, 255))
    g = S / 28
    for cx, cy in [(8, 8), (14, 8), (20, 8), (8, 20), (20, 20)]:
        r = 1.6 * g
        d.ellipse([cx * g - r, cy * g - r, cx * g + r, cy * g + r], fill=(255, 255, 255, 110))
    pts = [(4, 15), (7.2, 15), (9.3, 9.4), (12.7, 20.6), (15.3, 12.6), (16.9, 15), (24, 15)]
    d.line([(x * g, y * g) for x, y in pts], fill=(255, 255, 255, 255), width=int(2.4 * g), joint='curve')
    for x, y in [pts[0], pts[-1]]:
        r = 1.2 * g; d.ellipse([x * g - r, y * g - r, x * g + r, y * g + r], fill=(255, 255, 255, 255))
    im = im.resize((px, px), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return b.getvalue()

# ---------------- 組み立て ----------------
def main():
    os.makedirs(SDK, exist_ok=True)
    for f, p in DEPS.items():
        dst = os.path.join(SDK, f)
        if not os.path.exists(dst):
            print('取得中', f); urllib.request.urlretrieve(MAVEN + p, dst)
    shutil.rmtree(WORK, ignore_errors=True); os.makedirs(WORK + '/classes'); os.makedirs(OUT, exist_ok=True)
    # 1. Web アプリを最新にビルド
    sh('node', os.path.join(ROOT, 'build.mjs'))
    # 2. Java → class → dex
    sh('javac', '-nowarn', '--release', '8', '-encoding', 'UTF-8', '-cp', os.path.join(SDK, 'android-all.jar'), '-d', WORK + '/classes',
       *[os.path.join(dp, f) for dp, _, fs in os.walk(os.path.join(HERE, 'src')) for f in fs if f.endswith('.java')])
    sh('java', '-cp', os.path.join(SDK, 'dx.jar'), 'com.android.dx.command.Main', '--dex', '--min-sdk-version=' + str(MIN_SDK),
       '--output=' + WORK + '/classes.dex', WORK + '/classes')
    # 3. マニフェスト
    A = lambda name, t, v: (True, name, t, v)
    manifest = axml(('manifest', [(False, 'package', T_STR, PKG), A('versionCode', T_INT, VERSION_CODE), A('versionName', T_STR, VERSION_NAME),
                                  A('compileSdkVersion', T_INT, TARGET_SDK)], [
        ('uses-sdk', [A('minSdkVersion', T_INT, MIN_SDK), A('targetSdkVersion', T_INT, TARGET_SDK)], []),
        ('uses-permission', [A('name', T_STR, 'android.permission.INTERNET')], []),
        ('application', [A('label', T_STR, LABEL), A('icon', T_REF, 0x7f010000), A('roundIcon', T_REF, 0x7f010000),
                         A('allowBackup', T_BOOL, 0xFFFFFFFF), A('hardwareAccelerated', T_BOOL, 0xFFFFFFFF), A('largeHeap', T_BOOL, 0xFFFFFFFF)], [
            ('activity', [A('name', T_STR, PKG + '.MainActivity'), A('label', T_STR, LABEL), A('exported', T_BOOL, 0xFFFFFFFF),
                          A('configChanges', T_HEX, 0x0080 | 0x0020 | 0x0010 | 0x0100 | 0x0200 | 0x0400 | 0x0800),   # 回転・画面サイズ・キーボード・ダークモード切替で作り直さない
                          A('windowSoftInputMode', T_HEX, 0x10)], [
                ('intent-filter', [], [
                    ('action', [A('name', T_STR, 'android.intent.action.MAIN')], []),
                    ('category', [A('name', T_STR, 'android.intent.category.LAUNCHER')], []),
                ]),
            ]),
        ]),
    ]))
    # 4. ZIP (resources.arsc と画像は無圧縮・4 バイト境界)
    unsigned = WORK + '/unsigned.apk'
    files = [('AndroidManifest.xml', manifest, True), ('classes.dex', open(WORK + '/classes.dex', 'rb').read(), True),
             ('resources.arsc', arsc(), False)]
    for d, _, px in DENS: files.append(('res/mipmap-%s-v4/ic_launcher.png' % d, icon_png(px), False))
    files.append(('assets/index.html', open(os.path.join(ROOT, 'index.html'), 'rb').read(), True))
    with zipfile.ZipFile(unsigned, 'w') as z:
        for name, data, deflate in files:
            zi = zipfile.ZipInfo(name, date_time=(2026, 9, 27, 0, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED if deflate else zipfile.ZIP_STORED
            if not deflate:
                off = z.fp.tell() + 30 + len(name.encode())
                pad = (-off) % 4
                if pad: zi.extra = b'\x00' * pad
            z.writestr(zi, data)
    # 5. 署名 (初回は鍵を作る)
    ks = os.path.join(HERE, 'uniboard-release.p12')
    pw = os.environ.get('UB_KEY_PASS', 'uniboard-spice')
    if not os.path.exists(ks):
        sh('keytool', '-genkeypair', '-storetype', 'PKCS12', '-keystore', ks, '-alias', 'uniboard', '-keyalg', 'RSA', '-keysize', '2048',
           '-validity', '10000', '-storepass', pw, '-keypass', pw, '-dname', 'CN=UniBoard SPICE, O=UniBoard, C=JP')
    sh('javac', '-nowarn', '-cp', os.path.join(SDK, 'apksig.jar'), '-d', WORK, os.path.join(HERE, 'Sign.java'))
    apk = os.path.join(OUT, 'UniBoardSPICE.apk')
    print(sh('java', *[x for m in ('x509', 'pkcs', 'util') for x in ('--add-exports', 'java.base/sun.security.%s=ALL-UNNAMED' % m)], '-cp', WORK + os.pathsep + os.path.join(SDK, 'apksig.jar'), 'Sign', ks, 'uniboard', pw, unsigned, apk))
    print('APK:', apk, os.path.getsize(apk) // 1024, 'KB')

if __name__ == '__main__':
    main()
