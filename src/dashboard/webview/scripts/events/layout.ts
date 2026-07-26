export const LAYOUT_EVENTS_SCRIPT = `
    const syncTableScrollbarGutters = () => {
      for (const table of document.querySelectorAll('.body-scroll-table table')) {
        const body = table.tBodies[0];
        if (!body) continue;

        const scrollbarWidth = Math.max(
          0,
          body.offsetWidth - body.clientWidth
        );
        table.style.setProperty(
          '--table-scrollbar-width',
          scrollbarWidth + 'px'
        );
      }
    };

    const tableScrollbarObserver = new ResizeObserver(
      syncTableScrollbarGutters
    );
    for (const body of document.querySelectorAll('.body-scroll-table tbody')) {
      tableScrollbarObserver.observe(body);
    }
    window.addEventListener('resize', syncTableScrollbarGutters);
    requestAnimationFrame(syncTableScrollbarGutters);

    const preventBackgroundScroll = event => {
      const openDialog = Array.from(
        document.querySelectorAll('dialog[open]')
      ).pop();
      const target = event.target instanceof Element
        ? event.target
        : null;
      const modalScrollBody = target?.closest(
        '.dialog-scroll-body, .rule-dialog-body, .detail-dialog-body, .analysis-log'
      );

      if (
        openDialog &&
        (!modalScrollBody || !openDialog.contains(modalScrollBody))
      ) {
        event.preventDefault();
      }
    };

    document.addEventListener('wheel', preventBackgroundScroll, {
      capture: true,
      passive: false
    });
    document.addEventListener('touchmove', preventBackgroundScroll, {
      capture: true,
      passive: false
    });

    let modalScrollLocked = false;
    const updateModalScrollLock = () => {
      const hasOpenDialog = Boolean(
        document.querySelector('dialog[open]')
      );

      if (hasOpenDialog && !modalScrollLocked) {
        document.documentElement.classList.add('modal-scroll-locked');
        modalScrollLocked = true;
      } else if (!hasOpenDialog && modalScrollLocked) {
        document.documentElement.classList.remove('modal-scroll-locked');
        modalScrollLocked = false;
      }
    };

    const modalObserver = new MutationObserver(updateModalScrollLock);
    for (const dialog of document.querySelectorAll('dialog')) {
      modalObserver.observe(dialog, {
        attributes: true,
        attributeFilter: ['open']
      });
    }
`;
