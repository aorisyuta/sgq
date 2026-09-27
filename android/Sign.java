// APK 署名 (v2)。Google の apksig ライブラリを使う (minSdk 24 以上なので v2 だけでよい)
import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

public class Sign {
    public static void main(String[] a) throws Exception {
        // a: keystore alias password in out
        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream f = new FileInputStream(a[0])) { ks.load(f, a[2].toCharArray()); }
        PrivateKey key = (PrivateKey) ks.getKey(a[1], a[2].toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[1]);
        ApkSigner.SignerConfig sc = new ApkSigner.SignerConfig.Builder("uniboard", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(sc))
            .setInputApk(new File(a[3])).setOutputApk(new File(a[4]))
            .setMinSdkVersion(24).setV1SigningEnabled(false).setV2SigningEnabled(true)
            .build().sign();
        System.out.println("signed " + a[4]);
    }
}
