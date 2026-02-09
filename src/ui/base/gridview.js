import { initCustomElement } from './custom-element.js';
import { createLocalizedTemplate } from './template.js';

const gridviewTemplate = createLocalizedTemplate(
  `<style>:host{display:block;width:100%;overflow-y:overlay;overflow-x:hidden;position:relative}:host(.dnd) ::slotted(*){pointer-events:none}:host([data-error]):after{content:attr(data-error);position:absolute;top:50%;left:50%;transform:translate(-50%, -50%);padding:10px 20px;border-radius:5px;z-index:1;background-color:rgba(0,0,0,0.4);color:white;font-size:14px;font-weight:500;display:inline-block;text-align:center}#container{width:100%;min-height:100%;position:relative;direction:ltr}::slotted(*){position:absolute;transition:transform 250ms}::slotted(:not(.visible)){display:none}::slotted(.hidden){display:none}#selection-rect{display:none;position:absolute;z-index:10000000;border:1px solid #3367D6;background-color:rgba(51,103,214,0.25);border:1px solid rgba(0,0,0,0.3);transform:translate3d(0, 0, 0);pointer-events:none}#ghost-selection{display:block;position:fixed;top:100px;left:100px;left:-1000px;top:-1000px;width:400px;height:80px;background-color:transparent}#ghost-selection:after{content:attr(data-selection-size);display:inline-block;position:absolute;top:5px;left:5px;padding:10px 20px;font-size:25px;font-weight:bold;border-radius:1000px;border:5px solid white;color:white;text-align:center;background-color:#3367D6;box-shadow:2px 2px 5px 3px rgba(0,0,0,0.1)}</style><div id="container"><slot></slot><div id="selection-rect"></div></div><div id="ghost-selection"></div>`
);

function requestPermission(permission) {
  return new Promise(resolve => {
    chrome.permissions.request({ permissions: [permission] }, granted => resolve(granted));
  });
}

export function initGridview01Base(win) {
  if (win.Gridview01Base) {
    return win.Gridview01Base;
  }

  const CustomElement = initCustomElement(win);

  class Gridview01Base extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.paddingH = this.dataset.paddingH ? parseInt(this.dataset.paddingH, 10) : 20;
      this.paddingV = this.dataset.paddingV ? parseInt(this.dataset.paddingV, 10) : 20;
      this.columnWidth = this.dataset.columnWidth ? parseInt(this.dataset.columnWidth, 10) : 180;
      this.rowHeight = this.dataset.rowHeight ? parseInt(this.dataset.rowHeight, 10) : 180;
      this.columnsMax = this.dataset.columnsMax ? parseInt(this.dataset.columnsMax, 10) : 10;
      this.rowsMax = this.dataset.rowsMax ? parseInt(this.dataset.rowsMax, 10) : undefined;
      this._container = shadowRoot.querySelector('#container');
      this.update = this.update.bind(this);
      this._onResize = this._onResize.bind(this);

      new MutationObserver(mutations => {
        for (const mutation of mutations) {
          for (const removedChild of mutation.removedNodes) {
            removedChild.classList.remove('visible', 'hidden');
          }
        }
        this.update();
      }).observe(this, { childList: true });

      if (this.children.length) {
        this.update();
      }
    }

    hideChildren(filter) {
      for (const child of this.children) {
        if (filter && filter(child)) {
          child.classList.add('hidden');
        } else {
          child.classList.remove('hidden');
        }
      }
    }

    showAllChildren() {
      this.hideChildren();
    }

    hasFocus() {
      return !!(this.matches(':focus') || this.querySelector(':focus'));
    }

    set error(value) {
      if (value) {
        this.dataset.error = value;
      } else {
        delete this.dataset.error;
      }
    }

    get error() {
      return this.dataset.error;
    }

    _onResize() {
      clearTimeout(this._resizeTimeout);
      this._resizeTimeout = setTimeout(this.update, 200);
    }

    bind() {
      super.bind();
      addEventListener('resize', this._onResize);
    }

    unbind() {
      super.unbind();
      removeEventListener('resize', this._onResize);
    }
  }

  win.Gridview01Base = Gridview01Base;
  return Gridview01Base;
}

export function initGridview02Grid(win) {
  if (win.Gridview02Grid) {
    return win.Gridview02Grid;
  }

  const Gridview01Base = initGridview01Base(win);

  class Gridview02Grid extends Gridview01Base {
    pointToGridCoords(pleft, ptop, round = Math.round) {
      const x = Math.max(0, Math.min(this.columns - 1, round((pleft - this.left) / this.columnWidth)));
      const y = round((ptop - this.top) / this.rowHeight);
      return { x, y };
    }

    clientPointToIndex(x, y) {
      const r = this.getBoundingClientRect();
      return this.pointToIndex(x - r.left + this.scrollLeft, y - r.top + this.scrollTop);
    }

    pointToIndex(pleft, ptop) {
      const c = this.pointToGridCoords(pleft, ptop);
      return c.y * this.columns + c.x;
    }

    rectToIndices(pleft, ptop, width, height) {
      const c1 = this.pointToGridCoords(pleft, ptop, Math.ceil);
      const c2 = this.pointToGridCoords(pleft + width, ptop + height, Math.floor);
      const result = [];
      for (let y = c1.y; y <= c2.y; y++) {
        for (let x = c1.x; x <= c2.x; x++) {
          result.push(y * this.columns + x);
        }
      }
      return result;
    }

    indexToGridCoords(index) {
      return {
        x: index % this.columns,
        y: Math.floor(index / this.columns)
      };
    }

    indexToPoint(index) {
      const coords = this.indexToGridCoords(index);
      return {
        x: this.left + coords.x * this.columnWidth,
        y: this.top + coords.y * this.rowHeight
      };
    }

    getChildAtGridIndex(index) {
      return this.querySelector(`[data-grid-index='${index}']`);
    }

    getDOMDragOverIndex(index) {
      let gi = 0;
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (index === gi) {
          return i;
        }
        if (!child.classList.contains('hidden')) {
          gi++;
        }
      }
      return this.children.length;
    }

    update(dragOverIndex) {
      if (!this.children.length) {
        this._container.style.height = null;
        return;
      }

      const offsetWidth = this.offsetWidth;
      this.columnsMaxPossible = Math.floor((offsetWidth - 2 * this.paddingH) / this.columnWidth);
      this.columns = Math.min(this.columnsMaxPossible, this.columnsMax);
      this.left = Math.round((offsetWidth - this.columns * this.columnWidth) / 2 + this.columnWidth / 2);
      this.top = Math.round(this.paddingV + this.rowHeight / 2);
      this.width = this.columns * this.columnWidth;

      let gi = 0;
      for (const child of this.children) {
        if (child.classList.contains('hidden')) {
          child.dataset.gridIndex = -1;
          continue;
        }

        if (gi === dragOverIndex) {
          gi++;
        }

        child.dataset.gridIndex = gi;
        const xi = gi % this.columns;
        const yi = Math.floor(gi / this.columns);

        if (!this.rowsMax || yi < this.rowsMax) {
          child.style.display = null;
          const x = this.left + xi * this.columnWidth;
          const y = this.top + yi * this.rowHeight;
          child.classList.add('visible');
          child.style.transform = `translate(-50%, -50%) translate(${x}px,${y}px)`;
        } else {
          child.style.display = 'none';
        }

        gi++;
      }

      this._container.style.height = `${2 * this.paddingV + Math.ceil(this.children.length / this.columns) * this.rowHeight}px`;
    }
  }

  win.Gridview02Grid = Gridview02Grid;
  return Gridview02Grid;
}

export function initGridview03Selection(win) {
  if (win.Gridview03Selection) {
    return win.Gridview03Selection;
  }

  const Gridview02Grid = initGridview02Grid(win);

  class Gridview03Selection extends Gridview02Grid {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._selectionOrigin = null;
    }

    clearSelection() {
      this._selectionOrigin = null;
      for (const child of this.children) {
        child.classList.remove('-selected');
      }
      this.focus();
    }

    getSelectedChildren() {
      return Array.from(this.children).filter(child => child.classList.contains('-selected'));
    }

    setSelectionOrigin(index) {
      this._selectionOrigin = index;
    }

    getSelectionOrigin() {
      return this._selectionOrigin;
    }

    getSelectionEnd() {
      for (let i = 0; i < this.children.length; i++) {
        if (this.children[i].matches(':focus')) {
          return i;
        }
      }
      return -1;
    }

    beginSelection(index) {
      this._selectionOrigin = index;
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (i === index) {
          child.classList.add('-selected');
          child.focus();
        } else {
          child.classList.remove('-selected');
        }
      }
    }

    expandSelection(toIndex) {
      if (this._selectionOrigin === null) {
        this.beginSelection(toIndex);
        return;
      }

      const i0 = Math.min(this._selectionOrigin, toIndex);
      const inIndex = Math.max(this._selectionOrigin, toIndex);

      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (i < i0 || i > inIndex) {
          child.classList.remove('-selected');
        } else {
          child.classList.add('-selected');
        }

        if (i === toIndex) {
          child.focus();
        }
      }
    }

    toggleChildSelection(child) {
      if (child.parentNode === this) {
        child.classList.toggle('-selected');
      }
    }

    isChildSelected(child) {
      return child.parentNode === this && child.classList.contains('-selected');
    }

    select(fromIndex, toIndex) {
      this.beginSelection(fromIndex);
      this.expandSelection(toIndex);
    }

    selectAll() {
      if (this.children.length) {
        this._selectionOrigin = 0;
        for (const child of this.children) {
          child.classList.add('-selected');
        }
        this.children[this.children.length - 1].focus();
      }
    }

    getSelectionSize() {
      return this.getSelectedChildren().length;
    }

    toggleSelectionRect(x1, y1, x2, y2) {
      const scrollLeft = this.scrollLeft;
      const scrollTop = this.scrollTop;
      const rect = this.getBoundingClientRect();
      const left = Math.min(x1, x2) - scrollLeft;
      const top = Math.min(y1, y2) - scrollTop;
      const right = Math.max(x1, x2) - scrollLeft;
      const bottom = Math.max(y1, y2) - scrollTop;

      let firstIndex = -1;
      let lastIndex = -1;

      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        const rc = child.getBoundingClientRect();
        const xc = rc.left + rc.width / 2 - rect.left;
        const yc = rc.top + rc.height / 2 - rect.top;

        if (left < xc && right > xc && top < yc && bottom > yc) {
          child.classList.toggle('-selected');
          if (firstIndex === -1) {
            firstIndex = i;
          }
          lastIndex = i;
        }
      }

      if (firstIndex >= 0 && lastIndex >= 0) {
        if (y1 <= y2) {
          this.setSelectionOrigin(firstIndex);
          this.children[lastIndex].focus();
        } else {
          this.setSelectionOrigin(lastIndex);
          this.children[firstIndex].focus();
        }
      }
    }
  }

  win.Gridview03Selection = Gridview03Selection;
  return Gridview03Selection;
}

export function initGridview04SelectionKeyboard(win) {
  if (win.Gridview04SelectionKeyboard) {
    return win.Gridview04SelectionKeyboard;
  }

  const Gridview03Selection = initGridview03Selection(win);
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  const KEY_TAB = 9;
  const KEY_LEFT = 37;
  const KEY_RIGHT = 39;
  const KEY_UP = 38;
  const KEY_DOWN = 40;
  const KEY_HOME = 36;
  const KEY_END = 35;
  const KEY_PAGE_UP = 33;
  const KEY_PAGE_DOWN = 34;
  const KEY_A = 65;
  const KEY_ESC = 27;
  const selectionKeys = [KEY_TAB, KEY_LEFT, KEY_RIGHT, KEY_UP, KEY_DOWN, KEY_HOME, KEY_END, KEY_PAGE_UP, KEY_PAGE_DOWN];

  class Gridview04SelectionKeyboard extends Gridview03Selection {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onKeyDown = this._onKeyDown.bind(this);
      this.addEventListener('keydown', this._onKeyDown);
    }

    _onKeyDown(event) {
      if ((event.keyCode === KEY_LEFT) && event.altKey) {
        return;
      }

      if (selectionKeys.includes(event.keyCode)) {
        const n = this.children.length;
        if (!n) {
          return;
        }

        event.preventDefault();
        let index = this.getSelectionEnd();

        switch (event.keyCode) {
          case KEY_TAB:
            index += event.shiftKey ? -1 : 1;
            break;
          case KEY_UP:
            index -= this.columns;
            break;
          case KEY_DOWN:
            index += this.columns;
            break;
          case KEY_LEFT:
            index = (event.ctrlKey || event.metaKey) ? 0 : index - 1;
            break;
          case KEY_RIGHT:
            index = (event.ctrlKey || event.metaKey) ? n - 1 : index + 1;
            break;
          case KEY_HOME:
            index = 0;
            break;
          case KEY_END:
            index = n - 1;
            break;
          case KEY_PAGE_UP:
            index -= 3 * this.columns;
            break;
          case KEY_PAGE_DOWN:
            index += 3 * this.columns;
            break;
        }

        index = Math.min(n - 1, Math.max(0, index));

        if ((event.keyCode === KEY_TAB) || ((event.keyCode !== KEY_TAB) && !event.shiftKey)) {
          this.beginSelection(index);
        } else {
          this.expandSelection(index);
        }
      } else if (((isMac && event.metaKey) || (!isMac && event.ctrlKey)) && event.keyCode === KEY_A) {
        if (this.children.length) {
          this.selectAll();
        }
      } else if (event.keyCode === KEY_ESC) {
        if (this.children.length) {
          this.clearSelection();
        }
      }
    }
  }

  win.Gridview04SelectionKeyboard = Gridview04SelectionKeyboard;
  return Gridview04SelectionKeyboard;
}

export function initGridview05SelectionMouse(win) {
  if (win.Gridview05SelectionMouse) {
    return win.Gridview05SelectionMouse;
  }

  const Gridview04SelectionKeyboard = initGridview04SelectionKeyboard(win);
  const SCROLL_V = 1;

  class Gridview05SelectionMouse extends Gridview04SelectionKeyboard {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._disableMouseSelection = false;
      this._rect = shadowRoot.getElementById('selection-rect');
      this._startX = 0;
      this._startY = 0;
      this._endX = 0;
      this._endY = 0;
      this._clientX = 0;
      this._clientY = 0;
      this._scrollDir = 0;
      this._onMouseUp = this._onMouseUp.bind(this);
      this._onPointerDown = this._onPointerDown.bind(this);
      this._onSelectionResize = this._onSelectionResize.bind(this);
      this._onSelectionEnd = this._onSelectionEnd.bind(this);
      this._scroll = this._scroll.bind(this);
      this._onWindowClick = this._onWindowClick.bind(this);
      this._onWindowContextmenu = this._onWindowContextmenu.bind(this);
      this.addEventListener('mouseup', this._onMouseUp);
      this._container = shadowRoot.getElementById('container');
      this._container.addEventListener('pointerdown', this._onPointerDown);
    }

    _onSelectionStart(event) {
      if (this._disableMouseSelection) {
        return;
      }

      this.setPointerCapture(event.pointerId);
      this.classList.add('dnd');
      const r = this.getBoundingClientRect();
      this._endX = this._startX = event.clientX - r.left + this.scrollLeft;
      this._endY = this._startY = event.clientY - r.top + this.scrollTop;

      if (!(event.ctrlKey || event.shiftKey || event.metaKey)) {
        this.clearSelection();
      }

      window.addEventListener('mousemove', this._onSelectionResize);
      window.addEventListener('mouseup', this._onSelectionEnd);
      window.addEventListener('contextmenu', this._onWindowContextmenu, true);
      this.addEventListener('scroll', this._onSelectionResize);
    }

    _onSelectionResize(event) {
      const r = this.getBoundingClientRect();
      this._clientX = event.clientX || this._clientX;
      this._clientY = event.clientY || this._clientY;
      this._endX = Math.min(this.scrollWidth, Math.max(0, this._clientX - r.left + this.scrollLeft));
      this._endY = Math.min(this.scrollHeight, Math.max(0, this._clientY - r.top + this.scrollTop));

      this._rect.style.display = 'block';
      this._rect.style.left = `${Math.min(this._endX, this._startX)}px`;
      this._rect.style.top = `${Math.min(this._endY, this._startY)}px`;
      this._rect.style.width = `${Math.abs(this._endX - this._startX)}px`;
      this._rect.style.height = `${Math.abs(this._endY - this._startY)}px`;

      let scrollDir = 0;
      if (this._clientY < r.top) {
        scrollDir = -1;
      } else if (this._clientY > r.bottom) {
        scrollDir = 1;
      }

      if (scrollDir !== this._scrollDir) {
        if (this._scrollDir) {
          this._stopScrolling();
        }
        this._scrollDir = scrollDir;
        if (this._scrollDir) {
          this._startScrolling();
        }
      }
    }

    _onSelectionEnd() {
      this._stopScrolling();
      this.classList.remove('dnd');
      window.removeEventListener('mousemove', this._onSelectionResize);
      window.removeEventListener('mouseup', this._onSelectionEnd);
      window.removeEventListener('contextmenu', this._onWindowContextmenu, true);
      this.removeEventListener('scroll', this._onSelectionResize);
      this.toggleSelectionRect(this._startX, this._startY, this._endX, this._endY);
      this._rect.style.display = null;
    }

    _onPointerDown(event) {
      if (event.which === 2) {
        this.clearSelection();
      }

      if (event.target === this._container) {
        if (event.which === 1) {
          this._onSelectionStart(event);
        }
      } else {
        if (event.target.parentNode !== this) {
          return;
        }

        const target = event.target;
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (this.getSelectionSize()) {
            window.addEventListener('click', this._onWindowClick, true);
            if (event.shiftKey) {
              this.expandSelection(Array.from(this.children).indexOf(target));
            } else {
              this.toggleChildSelection(target);
            }
          }
        } else if (!this.isChildSelected(target)) {
          this.clearSelection();
        }
      }
    }

    _onWindowClick(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.removeEventListener('click', this._onWindowClick, true);
    }

    _onWindowContextmenu(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    _onMouseUp(event) {
      if (event.which === 2) {
        event.preventDefault();
      }
      if ((event.which === 1) && !(event.shiftKey || event.ctrlKey || event.metaKey)) {
        this.clearSelection();
      }
    }

    _scroll() {
      const now = Date.now();
      const dt = now - this._scrollT;
      const dy = this._scrollDir * SCROLL_V * dt;
      this.scrollTop += Math.round(dy);
      this._scrollT = now;
      this._scrollAnimationFrameId = requestAnimationFrame(this._scroll);
    }

    _startScrolling() {
      this._scrollT = Date.now();
      this._scroll();
    }

    _stopScrolling() {
      this._scrollDir = 0;
      cancelAnimationFrame(this._scrollAnimationFrameId);
    }
  }

  win.Gridview05SelectionMouse = Gridview05SelectionMouse;
  return Gridview05SelectionMouse;
}

export function initGridview06DND(win) {
  if (win.Gridview06DND) {
    return win.Gridview06DND;
  }

  const Gridview05SelectionMouse = initGridview05SelectionMouse(win);

  class Gridview06DND extends Gridview05SelectionMouse {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.ghostSelection = shadowRoot.getElementById('ghost-selection');
      this._onDragEnd = this._onDragEnd.bind(this);
      this.addEventListener('dragenter', this._onDragEnter.bind(this));
      this.addEventListener('dragleave', this._onDragLeave.bind(this));
      this.addEventListener('dragover', this._onDragOver.bind(this));
      this.addEventListener('drop', this._onDrop.bind(this));
      this.addEventListener('dragstart', this._onDragStart.bind(this));
    }

    _createCustomEvent(event, elements) {
      const r = this.getBoundingClientRect();
      const x = event.clientX - r.left + this.scrollLeft;
      const y = event.clientY - r.top + this.scrollTop;

      return new CustomEvent(`gridview-${event.type}`, {
        bubbles: true,
        cancelable: true,
        detail: {
          x,
          y,
          dataTransfer: event.dataTransfer,
          index: this.pointToIndex(x, y),
          elements
        }
      });
    }

    _onDragEnter(event) {
      event.stopImmediatePropagation();
      if (event.target === this) {
        this.classList.add('dnd');
        this.dispatchEvent(this._createCustomEvent(event));
      }
    }

    _onDragLeave(event) {
      event.stopImmediatePropagation();
      if (event.target === this) {
        this.classList.remove('dnd');
        this.dispatchEvent(this._createCustomEvent(event));
      }
    }

    _onDragOver(event) {
      event.stopImmediatePropagation();
      event.preventDefault();
      if (event.target !== this) {
        return;
      }

      const customEvent = this._createCustomEvent(event);
      if (this.dispatchEvent(customEvent)) {
        this.update(customEvent.detail.index);
      }
    }

    _onDrop(event) {
      this.classList.remove('dnd');
      event.preventDefault();
      if (this.dispatchEvent(this._createCustomEvent(event))) {
        this.update();
      }
    }

    _onDragStart(event) {
      if (event.target.parentNode !== this) {
        return;
      }

      event.stopImmediatePropagation();
      this._dragTarget = event.target;
      this._dragTarget.addEventListener('dragend', this._onDragEnd);

      let elements;
      if (this.isChildSelected(this._dragTarget)) {
        elements = this.getSelectedChildren();
        this.ghostSelection.dataset.selectionSize = elements.length;
        event.dataTransfer.setDragImage(this.ghostSelection, 0, 0);
      } else {
        elements = [this._dragTarget];
      }

      const customEvent = this._createCustomEvent(event, elements);
      if (this.dispatchEvent(customEvent)) {
        this.clearSelection();
        requestAnimationFrame(() => {
          this.hideChildren(child => elements.includes(child));
          this.update(customEvent.detail.index);
        });
      }
    }

    _onDragEnd(event) {
      event.stopImmediatePropagation();
      event.target.removeEventListener('dragend', this._onDragEnd);
      this._dragTarget = null;
      if (this.dispatchEvent(this._createCustomEvent(event))) {
        this.update();
      }
    }
  }

  win.Gridview06DND = Gridview06DND;
  return Gridview06DND;
}

export function initGridview07Clipboard(win) {
  if (win.Gridview07Clipboard) {
    return win.Gridview07Clipboard;
  }

  const Gridview06DND = initGridview06DND(win);

  class Gridview07Clipboard extends Gridview06DND {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onCopyOrCutOrPaste = this._onCopyOrCutOrPaste.bind(this);
    }

    bind() {
      super.bind();
      addEventListener('copy', this._onCopyOrCutOrPaste);
      addEventListener('cut', this._onCopyOrCutOrPaste);
      addEventListener('paste', this._onCopyOrCutOrPaste);
    }

    unbind() {
      super.unbind();
      removeEventListener('copy', this._onCopyOrCutOrPaste);
      removeEventListener('cut', this._onCopyOrCutOrPaste);
      removeEventListener('paste', this._onCopyOrCutOrPaste);
    }

    _onCopyOrCutOrPaste(event) {
      if (!(this.hasFocus() || this._executesCommand)) {
        return;
      }

      const executesCommand = this._executesCommand;
      this._executesCommand = false;
      event.preventDefault();

      switch (event.type) {
        case 'copy':
        case 'cut': {
          const elements = this.getSelectedChildren();
          if (!elements.length) {
            for (const child of this.children) {
              if (child.matches(':focus')) {
                elements.push(child);
                break;
              }
            }
          }

          if (!elements.length) {
            return;
          }

          this.dispatchEvent(new CustomEvent(`gridview-${event.type}`, {
            bubbles: true,
            cancelable: true,
            detail: { clipboardData: event.clipboardData, elements }
          }));
          break;
        }

        case 'paste': {
          const index = executesCommand ? this._pasteIndex : Number.MAX_VALUE;
          this.dispatchEvent(new CustomEvent('gridview-paste', {
            bubbles: true,
            cancelable: true,
            detail: { clipboardData: event.clipboardData, index }
          }));
          break;
        }
      }
    }

    async _execCommand(permission, cmd) {
      this._executesCommand = true;
      const granted = await requestPermission(permission);
      if (granted) {
        document.execCommand(cmd, true);
      }
    }

    copy() {
      this._execCommand('clipboardWrite', 'copy');
    }

    cut() {
      this._execCommand('clipboardWrite', 'cut');
    }

    paste(index) {
      this._pasteIndex = index;
      this._execCommand('clipboardRead', 'paste');
    }
  }

  win.Gridview07Clipboard = Gridview07Clipboard;
  return Gridview07Clipboard;
}

export function initGridview08ChildActive(win) {
  if (win.Gridview08ChildActive) {
    return win.Gridview08ChildActive;
  }

  const Gridview07Clipboard = initGridview07Clipboard(win);

  class Gridview08ChildActive extends Gridview07Clipboard {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onActiveEnd = this._onActiveEnd.bind(this);
      this.addEventListener('mousedown', this._onMouseDown.bind(this));
    }

    _onActiveEnd() {
      if (this._activeChild) {
        this._activeChild.classList.remove('-active');
        this._activeChild = null;
      }
    }

    _onMouseDown(event) {
      if ((event.target.parentNode === this) && !(event.shiftKey || event.ctrlKey || event.metaKey) && (event.which < 3)) {
        this._activeChild = event.target;
        this._activeChild.classList.add('-active');
      }
    }

    bind() {
      super.bind();
      window.addEventListener('mouseup', this._onActiveEnd, true);
      window.addEventListener('dragend', this._onActiveEnd, true);
    }

    unbind() {
      super.unbind();
      window.removeEventListener('mouseup', this._onActiveEnd, true);
      window.removeEventListener('dragend', this._onActiveEnd, true);
    }
  }

  win.Gridview08ChildActive = Gridview08ChildActive;
  return Gridview08ChildActive;
}

export function initGridview(win) {
  if (win.Gridview) {
    return win.Gridview;
  }

  const Gridview08ChildActive = initGridview08ChildActive(win);
  initCustomElement(win);

  class Gridview extends Gridview08ChildActive {}

  win.defineCustomElement('a-gridview', Gridview, gridviewTemplate);
  win.Gridview = Gridview;
  return Gridview;
}

export default {
  initGridview01Base,
  initGridview02Grid,
  initGridview03Selection,
  initGridview04SelectionKeyboard,
  initGridview05SelectionMouse,
  initGridview06DND,
  initGridview07Clipboard,
  initGridview08ChildActive,
  initGridview
};
