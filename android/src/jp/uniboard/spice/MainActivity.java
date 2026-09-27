package jp.uniboard.spice;

import android.app.Activity;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * UniBoard SPICE — Android 版
 * アプリ内の index.html を https の仮想オリジンで WebView に表示する
 * (localStorage・Web Worker・blob: がブラウザと同じように動くようにするため)。
 * ファイルの保存は JavaScript から AndroidBridge.saveFile() を呼び、Android の「保存先を選ぶ」画面で書き出す。
 */
public class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net/";
    private static final int REQ_OPEN = 1, REQ_SAVE = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingData;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 端末のダークモードに合わせたテーマ (WebView の prefers-color-scheme もこれに従う)
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        setTheme(night ? android.R.style.Theme_DeviceDefault_NoActionBar : android.R.style.Theme_DeviceDefault_Light_NoActionBar);
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        int surface = night ? 0xFF0F1512 : 0xFFF5FBF7;
        applyBars(surface, night ? 0xFF1B211E : 0xFFE9EFEB, !night);
        web = new WebView(this);
        web.setBackgroundColor(surface);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setBuiltInZoomControls(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!"appassets.androidplatform.net".equals(u.getHost())) return null;   // フォントなど外部はそのまま
                String path = u.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "text/javascript"
                            : path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : "application/octet-stream";
                    return new WebResourceResponse(mime, "utf-8", in);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("appassets.androidplatform.net".equals(u.getHost())) return false;
                // 外部リンクはブラウザで開く
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "ファイルを選ぶ"), REQ_OPEN);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(ORIGIN + "index.html");
    }

    /** JavaScript から呼ぶ窓口 */
    public class Bridge {
        @JavascriptInterface
        public void saveFile(final String name, final String mime, final String base64) {
            final byte[] data = Base64.decode(base64, Base64.DEFAULT);
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pendingData = data;
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    i.putExtra(Intent.EXTRA_TITLE, name);
                    try {
                        startActivityForResult(i, REQ_SAVE);
                    } catch (Exception e) {
                        pendingData = null;
                        Toast.makeText(MainActivity.this, "保存できませんでした", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public String platform() { return "android"; }

        /** 触感フィードバック: 1 = タップ / 16 = 完了 / 17 = 失敗 */
        @JavascriptInterface
        public void haptic(final int kind) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    int k = kind == 16 ? (Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.VIRTUAL_KEY)
                            : kind == 17 ? (Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS)
                            : HapticFeedbackConstants.KEYBOARD_TAP;
                    web.performHapticFeedback(k);
                }
            });
        }

        /** ステータスバー・ナビゲーションバーの色を画面 (アプリバー / 下のナビゲーション) に合わせる */
        @JavascriptInterface
        public void setSystemBars(final String status, final String nav, final boolean light) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try { applyBars(Color.parseColor(status), Color.parseColor(nav), light); } catch (Exception ignored) { }
                }
            });
        }
    }

    @SuppressWarnings("deprecation")
    private void applyBars(int status, int nav, boolean light) {
        Window w = getWindow();
        w.setStatusBarColor(status);
        w.setNavigationBarColor(nav);
        View d = w.getDecorView();
        int f = d.getSystemUiVisibility();
        f = light ? (f | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        if (Build.VERSION.SDK_INT >= 26) f = light ? (f | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR) : (f & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        d.setSystemUiVisibility(f);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_OPEN) {
            if (fileCallback == null) return;
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    result = new Uri[n];
                    for (int k = 0; k < n; k++) result[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) result = new Uri[]{data.getData()};
            }
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        } else if (requestCode == REQ_SAVE) {
            byte[] d = pendingData;
            pendingData = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || d == null) return;
            try {
                OutputStream out = getContentResolver().openOutputStream(data.getData());
                out.write(d);
                out.close();
                Toast.makeText(this, "保存しました", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "保存できませんでした: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    /** 戻るボタン: 開いている画面 (ダイアログ・パネル) を先に閉じ、何もなければアプリを閉じる */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.UBAndroidBack ? window.UBAndroidBack() : false)", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String v) {
                if (!"true".equals(v)) MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    protected void onDestroy() {
        if (web != null) { web.setVisibility(View.GONE); web.destroy(); }
        super.onDestroy();
    }
}
