// U23-HYDRA-SHIELD — pre-hydration extension shield.
//
// The owner's browser extensions inject attributes (observed in the wild:
// `bis_size`, plus the usual suspects Grammarly / LanguageTool / ColorZilla)
// into the server HTML BEFORE React hydrates. React then reports
// "A tree hydrated but some attributes of the server rendered HTML didn't
// match the client properties" with hundreds of `bis_size={...}` diff lines.
// Our SSR output is verified correct; the mismatch is 100% extension noise.
//
// Fix: a tiny inline script rendered as the FIRST child of <body>. It runs
// synchronously during HTML parsing — i.e. always before React hydration —
// and (a) strips known extension-injected attributes and (b) installs a
// MutationObserver so anything injected later (before or after hydration)
// is removed as well. Same pattern next-themes uses to avoid theme flash.
const SHIELD_SCRIPT = `(function(){
  try {
    var BAD = [
      'bis_size',
      'data-gr-ext-installed',
      'data-new-gr-c-s-check-loaded',
      'data-new-gr-c-s-loaded',
      'data-gr-time-installed',
      'cz-shortcut-listen',
      'data-lt-installed',
      'data-extension-version',
      'data-dashlane-rid',
      'data-lastpass-icon',
      'data-lastpass-root'
    ];
    function clean(root) {
      try {
        if (!root || !root.querySelectorAll) return;
        var sel = BAD.map(function(a) { return '[' + a + ']'; }).join(',');
        var els = root.querySelectorAll(sel);
        for (var i = 0; i < els.length; i++) {
          for (var j = 0; j < BAD.length; j++) {
            if (els[i].hasAttribute(BAD[j])) els[i].removeAttribute(BAD[j]);
          }
        }
      } catch (e) {}
    }
    function start() {
      clean(document);
      try {
        var mo = new MutationObserver(function(muts) {
          for (var k = 0; k < muts.length; k++) {
            var m = muts[k];
            if (m.type === 'attributes') {
              var name = m.attributeName;
              if (name && BAD.indexOf(name) !== -1 && m.target && m.target.getAttribute && m.target.getAttribute(name) !== null) {
                m.target.removeAttribute(name);
              }
            } else if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
              for (var n = 0; n < m.addedNodes.length; n++) {
                var node = m.addedNodes[n];
                if (node && node.nodeType === 1) clean(node);
              }
            }
          }
        });
        mo.observe(document.documentElement || document, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: BAD
        });
      } catch (e) {}
    }
    start();
  } catch (e) {}
})();`;

// dev-only tail — U23-HYDRA-AUTOHEAL: while the owner browses the preview
// panel, loading the page EXACTLY across a recompile can pair server HTML
// from one code version with client JS from another (observed twice: the
// radix `aria-controls` useId differs by a root-level sibling — e.g.
// StoreBoot being added — while the server ID matches a fresh load
// byte-for-byte). React then logs the scary "A tree hydrated but…" error
// even though the code itself hydrates cleanly.
// Self-heal: if such a log appears, reload the tab ONCE quietly — the fresh
// load always pairs matching HTML+JS. Throttled through sessionStorage
// (15s) so a GENUINE mismatch still surfaces after a single retry instead
// of looping. Production builds never receive this tail.
const AUTOHEAL_SCRIPT = `
(function(){
  try {
    var origError = console.error;
    console.error = function() {
      try {
        var msg = '';
        for (var i = 0; i < arguments.length; i++) {
          msg += (typeof arguments[i] === 'string' ? arguments[i] : ' ');
        }
        if (msg.indexOf('A tree hydrated') !== -1 || msg.indexOf('Hydration failed') !== -1 || msg.indexOf('error while hydrating') !== -1) {
          var now = Date.now();
          var last = 0;
          try { last = parseInt(sessionStorage.getItem('__hydra_reload') || '0', 10) || 0; } catch (e) {}
          if (!last || now - last > 15000) {
            try { sessionStorage.setItem('__hydra_reload', String(now)); } catch (e) {}
            window.location.reload();
            return;
          }
        }
      } catch (e) {}
      return origError.apply(console, arguments);
    };
  } catch (e) {}
})();`;

export function ExtensionShield() {
  const isProd = process.env.NODE_ENV === 'production';
  return (
    <script
      id="extension-shield"
      // Runs synchronously during HTML parse, before React hydrates.
      dangerouslySetInnerHTML={{
        __html: isProd ? SHIELD_SCRIPT : SHIELD_SCRIPT + AUTOHEAL_SCRIPT,
      }}
    />
  );
}
