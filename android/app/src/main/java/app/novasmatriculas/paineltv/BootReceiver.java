package app.novasmatriculas.paineltv;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Abre o painel automaticamente quando o Chromecast / TV Box liga. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String a = intent.getAction();
        if (!a.equals(Intent.ACTION_BOOT_COMPLETED)
                && !a.equals("android.intent.action.LOCKED_BOOT_COMPLETED")
                && !a.equals("android.intent.action.QUICKBOOT_POWERON")) {
            return;
        }
        try {
            Intent open = new Intent(context, MainActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(open);
        } catch (Exception ignored) {
            // Alguns sistemas bloqueiam abrir telas no boot; aí basta abrir pelo ícone.
        }
    }
}
