var siteBase = document.querySelector("base");
      if (siteBase) siteBase.href = siteBase.href;
      else {
        var tokenRoot = location.pathname.match(/^(.*\/)squeek\/[^/]+\/?$/);
        siteBase = document.createElement("base");
        siteBase.href = tokenRoot ? new URL(tokenRoot[1], location.href).href : new URL("./", location.href).href;
        document.head.prepend(siteBase);
      }
      try {
        var t = localStorage.getItem("squeek-ledger:theme");
        document.documentElement.dataset.theme = t === "light" || t === "dark" ? t : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } catch (e) {}