package app.novasmatriculas.paineltv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Painel de Matrículas para TV: abre o site em tela cheia, sem barra de
 * endereço, mantém a tela ligada e tenta de novo sozinho se a internet cair.
 *
 * Controle remoto:
 *  - ◀ ▶  trocam de slide;  OK pausa/continua
 *  - segurar OK (~1 s) ou botão MENU: configurações (endereço do painel)
 */
public class MainActivity extends Activity {

    static final String DEFAULT_URL = "https://novasmatriculas.vercel.app/?leve=1";
    private static final String PREFS = "painel";
    private static final String KEY_URL = "url";
    private static final long RETRY_MS = 15_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private WebView web;
    private TextView status;
    private boolean longPressHandled = false;
    private AlertDialog settingsDialog;

    private final Runnable retry = new Runnable() {
        @Override
        public void run() {
            status.setVisibility(View.GONE);
            if (web != null) web.loadUrl(getUrl());
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                        | WindowManager.LayoutParams.FLAG_FULLSCREEN
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(0, 54, 96));

        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setTextSize(22);
        status.setPadding(48, 48, 48, 48);
        status.setVisibility(View.GONE);

        createWebView();
        root.addView(status, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        setContentView(root);
        hideSystemUi();
        web.loadUrl(getUrl());
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void createWebView() {
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(0, 54, 96));
        web.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " PainelTV-Android");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // tudo abre dentro do app
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showOfflineAndRetry();
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // O motor do navegador caiu (falta de memória): recria a página.
                root.removeView(web);
                web.destroy();
                createWebView(); // já adiciona a nova WebView na tela
                web.loadUrl(getUrl());
                web.requestFocus();
                return true;
            }
        });

        root.addView(web, 0, matchParent());
        web.requestFocus();
    }

    private static FrameLayout.LayoutParams matchParent() {
        return new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
    }

    private void showOfflineAndRetry() {
        web.loadData(
                "<html><body style='background:#003660'></body></html>", "text/html", "utf-8");
        status.setText("Sem conexão com o painel. Tentando novamente em instantes…\n" + getUrl());
        status.setVisibility(View.VISIBLE);
        handler.removeCallbacks(retry);
        handler.postDelayed(retry, RETRY_MS);
    }

    private String getUrl() {
        SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        return p.getString(KEY_URL, DEFAULT_URL);
    }

    private void saveUrl(String url) {
        String u = url.trim();
        if (u.isEmpty()) u = DEFAULT_URL;
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "https://" + u;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_URL, u).apply();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();

        if (code == KeyEvent.KEYCODE_MENU || code == KeyEvent.KEYCODE_SETTINGS) {
            if (event.getAction() == KeyEvent.ACTION_UP) showSettings();
            return true;
        }

        // Segurar OK por ~1 s abre as configurações
        if (code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() > 0) {
                if (!longPressHandled && event.getRepeatCount() >= 12) {
                    longPressHandled = true;
                    showSettings();
                }
                return true;
            }
            if (event.getAction() == KeyEvent.ACTION_UP && longPressHandled) {
                longPressHandled = false;
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private void showSettings() {
        if (settingsDialog != null && settingsDialog.isShowing()) return;

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(48, 24, 48, 0);

        TextView hint = new TextView(this);
        hint.setText("Endereço do painel (use ?leve=1 para o modo leve):");
        box.addView(hint);

        final EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setSingleLine(true);
        input.setText(getUrl());
        box.addView(input);

        TextView version = new TextView(this);
        version.setText("Versão " + BuildConfigVersion.name(this));
        version.setPadding(0, 16, 0, 0);
        box.addView(version);

        settingsDialog = new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
                .setTitle("Configurações do painel")
                .setView(box)
                .setPositiveButton("Salvar", (d, w) -> {
                    saveUrl(input.getText().toString());
                    web.loadUrl(getUrl());
                })
                .setNeutralButton("Padrão", (d, w) -> {
                    saveUrl(DEFAULT_URL);
                    web.loadUrl(getUrl());
                })
                .setNegativeButton("Recarregar", (d, w) -> web.reload())
                .setOnDismissListener(d -> {
                    hideSystemUi();
                    web.requestFocus();
                })
                .create();
        settingsDialog.show();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        if (web != null) {
            web.onResume();
            web.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Lê o versionName sem depender da classe BuildConfig gerada. */
    static final class BuildConfigVersion {
        static String name(Activity a) {
            try {
                return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "?";
            }
        }
    }
}
