/* Diagnóstico para TVs: abra a página com ?debug=1.
   Escrito em JavaScript antigo (ES5) de propósito, para rodar até em
   navegadores/WebViews desatualizados onde o resto da página falha. */
(function () {
  if (!/[?&]debug=1/.test(location.search)) return;
  var errs = [];
  var box;
  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }
  function render(extra) {
    if (!document.body) return;
    if (!box) {
      box = document.createElement("div");
      box.style.cssText =
        "position:fixed;left:10px;top:10px;right:10px;z-index:2147483647;background:rgba(0,0,0,.85);" +
        "color:#fff;font:16px/1.4 monospace;padding:12px;border-radius:8px;white-space:pre-wrap;word-break:break-all;max-height:90vh;overflow:hidden";
      document.body.appendChild(box);
    }
    var cv = (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || "?";
    box.innerHTML =
      "<b>DIAGNÓSTICO DO PAINEL</b>\n" +
      "Versão do Chrome/WebView: " + cv + "\n" +
      "Tela: " + window.innerWidth + "x" + window.innerHeight + " @" + (window.devicePixelRatio || 1) + "\n" +
      "Página iniciou (React): " + (window.__painelOK ? "SIM" : "NÃO") + "\n" +
      (extra || "") +
      "Erros (" + errs.length + "):\n" + esc(errs.slice(-6).join("\n")) + "\n" +
      "UA: " + esc(navigator.userAgent);
  }
  var dataInfo = "Dados: verificando…\n";
  window.addEventListener("error", function (e) {
    errs.push((e.message || "erro") + (e.filename ? " @ " + e.filename.split("/").pop() + ":" + e.lineno : ""));
    render(dataInfo);
  });
  window.addEventListener("unhandledrejection", function (e) {
    errs.push("Promise: " + (e.reason && e.reason.message ? e.reason.message : e.reason));
    render(dataInfo);
  });
  try {
    var x = new XMLHttpRequest();
    x.open("GET", "/api/data", true);
    x.onload = function () {
      try {
        var d = JSON.parse(x.responseText);
        var r = d.sources && d.sources.relatorio;
        dataInfo =
          "Dados do servidor: HTTP " + x.status + " · publicado " + d.updatedAt +
          " · relatório " + (r ? "OK (" + r.captacao + " novos)" : "VAZIO") + "\n";
      } catch (e) {
        dataInfo = "Dados do servidor: resposta inválida (HTTP " + x.status + ")\n";
      }
      render(dataInfo);
    };
    x.onerror = function () {
      dataInfo = "Dados do servidor: FALHA DE REDE\n";
      render(dataInfo);
    };
    x.send();
  } catch (e) {
    dataInfo = "Dados do servidor: erro " + e + "\n";
  }
  document.addEventListener("DOMContentLoaded", function () { render(dataInfo); });
  setInterval(function () { render(dataInfo); }, 2000);
})();
