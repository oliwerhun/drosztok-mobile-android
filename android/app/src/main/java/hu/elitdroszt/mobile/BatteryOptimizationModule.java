package hu.elitdroszt.mobile;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BatteryOptimizationModule extends ReactContextBaseJavaModule {

    private final ReactApplicationContext reactContext;

    public BatteryOptimizationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "BatteryOptimization";
    }

    @ReactMethod
    public void isIgnoringBatteryOptimizations(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                String packageName = reactContext.getPackageName();
                PowerManager pm = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
                boolean isIgnoring = pm.isIgnoringBatteryOptimizations(packageName);
                promise.resolve(isIgnoring);
            } else {
                // Older Android versions don't have this specific optimization
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isAutoRevokeWhitelisted(Promise promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { // API 30 Android 11
                String packageName = reactContext.getPackageName();
                boolean isWhitelisted = reactContext.getPackageManager().isAutoRevokeWhitelisted(packageName);
                promise.resolve(isWhitelisted);
            } else {
                // Older versions don't have this feature
                promise.resolve(true);
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void openBatterySettings(Promise promise) {
        try {
            Intent intent = new Intent();
            String manufacturer = android.os.Build.MANUFACTURER.toLowerCase();

            // Kínai gyártóknál (Xiaomi, Huawei, Oppo, stb.) érdemes megpróbálni a speciális
            // "Indítópult" / "Security Center" menüt.
            // De ha ezek nem működnek, vagy Samsungról van szó, akkor az App Info a
            // legjobb.

            boolean isChineseSpecific = false;

            if (manufacturer.contains("huawei")) {
                intent.setComponent(new ComponentName("com.huawei.systemmanager",
                        "com.huawei.systemmanager.optimize.process.ProtectActivity"));
                isChineseSpecific = true;
            } else if (manufacturer.contains("xiaomi")) {
                intent.setComponent(new ComponentName("com.miui.securitycenter",
                        "com.miui.permcenter.autostart.AutoStartManagementActivity"));
                isChineseSpecific = true;
            } else if (manufacturer.contains("oppo")) {
                intent.setComponent(new ComponentName("com.coloros.safecenter",
                        "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
                isChineseSpecific = true;
            } else if (manufacturer.contains("vivo")) {
                intent.setComponent(new ComponentName("com.vivo.permissionmanager",
                        "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
                isChineseSpecific = true;
            } else if (manufacturer.contains("oneplus")) {
                intent.setComponent(new ComponentName("com.oneplus.security",
                        "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"));
                isChineseSpecific = true;
            }

            // Ha van specifikus kínai intent és feloldható
            if (isChineseSpecific && reactContext.getPackageManager().resolveActivity(intent, 0) != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                reactContext.startActivity(intent);
                promise.resolve(true);
                return;
            }

            // Samsung és minden más (vagy fallback): App Info képernyő
            // Innen 1 kattintás az "Akkumulátor" menüpont.
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            Uri uri = Uri.fromParts("package", reactContext.getPackageName(), null);
            intent.setData(uri);
            reactContext.startActivity(intent);
            promise.resolve(true);

        } catch (Exception e) {
            // Végső fallback: Általános beállítások
            try {
                Intent intent = new Intent(Settings.ACTION_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                reactContext.startActivity(intent);
                promise.resolve(true);
            } catch (Exception ex) {
                promise.reject("ERROR", ex.getMessage());
            }
        }
    }
}
