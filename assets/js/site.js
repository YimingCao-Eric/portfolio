/* Site chrome: theme, sticky header, scroll reveal, slide viewer. */
(function () {
  "use strict";

  /* ---------- theme ---------- */
  var KEY = "yc-theme";
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  } catch (e) {}

  function currentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    var next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(KEY, next); } catch (err) {}
    document.dispatchEvent(new CustomEvent("themechange", { detail: next }));
  });

  document.addEventListener("DOMContentLoaded", function () {
    /* ---------- sticky header shadow ---------- */
    var header = document.querySelector(".site-header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-stuck", window.scrollY > 8);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    /* ---------- reveal on scroll ---------- */
    var targets = document.querySelectorAll(".reveal");
    if (targets.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-visible");
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
      targets.forEach(function (t, i) {
        t.style.transitionDelay = Math.min(i % 6, 5) * 45 + "ms";
        io.observe(t);
      });
    } else {
      targets.forEach(function (t) { t.classList.add("is-visible"); });
    }

    /* ---------- slide viewers ---------- */
    document.querySelectorAll("[data-slides]").forEach(initSlides);

    /* ---------- deck switcher ---------- */
    var tabs = document.querySelectorAll("[data-deck-tab]");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var key = tab.dataset.deckTab;
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        document.querySelectorAll("[data-deck-panel]").forEach(function (panel) {
          panel.hidden = panel.dataset.deckPanel !== key;
        });
      });
    });
  });

  function initSlides(root) {
    var base = root.dataset.slides,
      count = parseInt(root.dataset.slidesCount, 10) || 0,
      pad = parseInt(root.dataset.slidesPad, 10) || 2,
      ext = root.dataset.slidesExt || "jpg",
      stage = root.querySelector("[data-slide-stage]"),
      label = root.querySelector("[data-slide-label]"),
      prev = root.querySelector("[data-slide-prev]"),
      next = root.querySelector("[data-slide-next]"),
      rail = root.querySelector("[data-slide-rail]"),
      i = 0;

    if (!stage || !count) return;

    function src(n) {
      var s = String(n + 1);
      while (s.length < pad) s = "0" + s;
      return base + s + "." + ext;
    }

    var img = document.createElement("img");
    img.alt = "";
    img.loading = "eager";
    img.decoding = "async";
    stage.appendChild(img);

    if (rail) {
      for (var k = 0; k < count; k++) {
        (function (k) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "slide-thumb";
          b.setAttribute("aria-label", "Slide " + (k + 1));
          var ti = document.createElement("img");
          ti.src = src(k); ti.alt = ""; ti.loading = "lazy"; ti.decoding = "async";
          b.appendChild(ti);
          b.addEventListener("click", function () { go(k); });
          rail.appendChild(b);
        })(k);
      }
    }

    function go(n, isInitial) {
      i = (n + count) % count;
      img.src = src(i);
      img.alt = "Slide " + (i + 1) + " of " + count;
      if (label) label.textContent = (i + 1) + " / " + count;
      if (rail) {
        rail.querySelectorAll(".slide-thumb").forEach(function (b, idx) {
          b.classList.toggle("is-active", idx === i);
        });
        // Scroll the rail itself — never scrollIntoView, which would drag the
        // whole page down to the viewer on first paint.
        var active = rail.children[i];
        if (active && !isInitial) {
          var target = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
          rail.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
        }
      }
    }

    if (prev) prev.addEventListener("click", function () { go(i - 1); });
    if (next) next.addEventListener("click", function () { go(i + 1); });

    root.setAttribute("tabindex", "0");
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    });

    go(0, true);
  }
})();
