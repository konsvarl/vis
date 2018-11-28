const Item = require('./Item');
var util = require('../../../util');

function ClusterItem(data, conversion, options) {
  this.props = {
    content: {
      width: 0,
      height: 0
    },
  };

  this.options = Object.assign({}, options, {
    editable: false
  });

  if (!data || data.items == undefined) {
    throw new Error('Property "items" missing in item ' + data.id);
  }

  Item.call(this, data, conversion, this.options);
  this.id = util.randomUUID();
  this.group = data.grop;
  this.isCluster = true;
  this._setupRange();

  this.emitter = this.data.eventEmitter;

  
}

ClusterItem.prototype = new Item(null, null, null);
ClusterItem.prototype.baseClassName = 'vis-item vis-range vis-cluster';

ClusterItem.prototype.hasItems = function () {
  return this.items && this.items.length && this.attached;
}

ClusterItem.prototype.isVisible = function (range) {
  if (this.data.end && this.data.start) {
    return (this.data.start < range.end) && (this.data.end > range.start) && this.hasItems();
  }

  const widthInMs = this.width * range.getMillisecondsPerPixel();
  return (this.data.start.getTime() + widthInMs / 2 > range.start) && (this.data.start.getTime() - widthInMs / 2 < range.end) &&
    this.hasItems();
};

ClusterItem.prototype.getData = function () {
  return {
    isCluster: true,
    id: this.id,
    items: (this.items || []).map(item => item.getData()),
    data: this.data
  }
}

ClusterItem.prototype.redraw = function (returnQueue) {
  var sizes
  var queue = [
    // create item DOM
    this._createDomElement.bind(this),

    // append DOM to parent DOM
    this._appendDomElement.bind(this),

    // update dirty DOM
    this._updateDirtyDomComponents.bind(this),

    (function () {
      if (this.dirty) {
        sizes = this._getDomComponentsSizes();
      }
    }).bind(this),

    (function () {
      if (this.dirty) {
        this._updateDomComponentsSizes.bind(this)(sizes);
      }
    }).bind(this),

    // repaint DOM additionals
    this._repaintDomAdditionals.bind(this)
  ];

  if (returnQueue) {
    return queue;
  } else {
    var result;
    queue.forEach(function (fn) {
      result = fn();
    });
    return result;
  }
};

ClusterItem.prototype.show = function () {
  if (!this.displayed) {
    this.redraw();
  }
};

/**
 * Hide the item from the DOM (when visible)
 */
ClusterItem.prototype.hide = function () {
  if (this.displayed) {
    var dom = this.dom;
    if (dom.box.parentNode) {
      dom.box.parentNode.removeChild(dom.box);
    }

    this.displayed = false;
  }
};

ClusterItem.prototype.repositionX = function () {
  let start = this.conversion.toScreen(this.data.start);
  let end = this.data.end ? this.conversion.toScreen(this.data.end) : 0;
  if (end) {
    this.repositionXWithRanges(start, end);
  } else {
    let align = this.data.align === undefined ? this.options.align : this.data.align;
    this.repositionXWithoutRanges(start, align);
  }
};

ClusterItem.prototype.repositionXWithoutRanges = function (start, align) {
  // calculate left position of the box
  if (align == 'right') {
    if (this.options.rtl) {
      this.right = start - this.width;

      // reposition box, line, and dot
      this.dom.box.style.right = this.right + 'px';
    } else {
      this.left = start - this.width;

      // reposition box, line, and dot
      this.dom.box.style.left = this.left + 'px';
    }
  } else if (align == 'left') {
    if (this.options.rtl) {
      this.right = start;

      // reposition box, line, and dot
      this.dom.box.style.right = this.right + 'px';
    } else {
      this.left = start;

      // reposition box, line, and dot
      this.dom.box.style.left = this.left + 'px';
    }
  } else {
    // default or 'center'
    if (this.options.rtl) {
      this.right = start - this.width / 2;

      // reposition box, line, and dot
      this.dom.box.style.right = this.right + 'px';
    } else {
      this.left = start - this.width / 2;

      // reposition box, line, and dot
      this.dom.box.style.left = this.left + 'px';
    }
  }
}

ClusterItem.prototype.repositionXWithRanges = function (start, end) {
  // add 0.5 to compensate floating-point values rounding
  let boxWidth = Math.max(end - start + 0.5, 1);

  if (this.options.rtl) {
    this.right = start;
  } else {
    this.left = start;
  }

  this.width = Math.max(boxWidth, this.minWidth || 0);

  if (this.options.rtl) {
    this.dom.box.style.right = this.right + 'px';
  } else {
    this.dom.box.style.left = this.left + 'px';
  }

  this.dom.box.style.width = boxWidth + 'px';
}

ClusterItem.prototype.repositionY = function () {
  var orientation = this.options.orientation.item;
  var box = this.dom.box;
  if (orientation == 'top') {
    box.style.top = (this.top || 0) + 'px';
  } else { // orientation 'bottom'
    box.style.top = (this.parent.height - this.top - this.height || 0) + 'px';
  }
};

ClusterItem.prototype.getWidthLeft = function () {
  return this.width / 2;
};

ClusterItem.prototype.getWidthRight = function () {
  return this.width / 2;
};

ClusterItem.prototype.move = function () {
  this.repositionX();
  this.repositionY();
}

ClusterItem.prototype.attach = function () {
  for (let item of this.items) {
    item.cluster = this;
  }

  this.attached = true;
}

ClusterItem.prototype.detach = function (detachFromParent = false) {
  if (!this.hasItems()) {
    return;
  }

  for (let item of this.items) {
    delete item.cluster;
  }

  this.attached = false;

  if (detachFromParent && this.group) {
    this.group.remove(this);
    this.group = null;
  }
}

ClusterItem.prototype._getContentWidth = function () {
  const domNodes = [];
  for (let i = 0; i < this.dom.box.children.length; i++) {
    domNodes.push(this.dom.box.children[i]);
  }
  let totalWidth = 0;
  while (domNodes.length > 0) {
    const currentNode = domNodes.shift();
    totalWidth += currentNode.offsetWidth;
    for (let i = 0; i < currentNode.children.length; i++) {
      domNodes.push(currentNode.children[i]);
    }
  }

  return totalWidth;
}


ClusterItem.prototype._onDoubleClick = function () {
  if (this.emitter) {
    this.emitter.emit('fit', {
      start: new Date(this.data.min),
      end: new Date(this.data.max),
      animation: true
    });
  }
}

ClusterItem.prototype._setupRange = function () {
  const {
    items
  } = this.data;
  this.items = items;

  const stats = items.map(item => ({
    start: item.data.start.valueOf(),
    end: item.data.end ? item.data.end.valueOf() : item.data.start.valueOf(),
  }));

  this.data.min = Math.min(...stats.map(s => Math.min(s.start, s.end || s.start)));
  this.data.max = Math.max(...stats.map(s => Math.max(s.start, s.end || s.start)));
  const centers = items.map(item => item.center);
  const avg = centers.reduce((sum, value) => sum + value, 0) / items.length;
  if (this.items.some(item => item.data.end)) {
    // contains ranges
    this.data.start = new Date(this.data.min);
    this.data.end = new Date(this.data.max);
  } else {
    this.data.start = new Date(avg);
    this.data.end = null;
  }
}

ClusterItem.prototype._getItems = function () {
  if (this.items && this.items.length) {
    return this.items.filter(item => item.cluster === this);
  }
  return [];
}

ClusterItem.prototype._createDomElement = function () {
  if (!this.dom) {
    // create DOM
    this.dom = {};

    // create main box
    this.dom.box = document.createElement('DIV');

    // contents box (inside the background box). used for making margins
    this.dom.content = document.createElement('DIV');
    this.dom.content.className = 'vis-item-content';
    this.dom.box.appendChild(this.dom.content);

    this.dom.box.ondblclick = ClusterItem.prototype._onDoubleClick.bind(this);

    // attach this item as attribute
    this.dom.box['timeline-item'] = this;

    this.dirty = true;
  }
}

ClusterItem.prototype._appendDomElement = function () {
  if (!this.parent) {
    throw new Error('Cannot redraw item: no parent attached');
  }

  if (!this.dom.box.parentNode) {
    const foreground = this.parent.dom.foreground;
    if (!foreground) {
      throw new Error('Cannot redraw item: parent has no foreground container element');
    }

    foreground.appendChild(this.dom.box);
  }

  this.displayed = true;
}


ClusterItem.prototype._updateDirtyDomComponents = function () {
  // An item is marked dirty when:
  // - the item is not yet rendered
  // - the item's data is changed
  // - the item is selected/deselected
  if (this.dirty) {
    this._updateContents(this.dom.content);
    this._updateDataAttributes(this.dom.box);
    this._updateStyle(this.dom.box);

    // update class
    const className = this.baseClassName + ' ' + (this.data.className ? ' ' + this.data.className : '') +
      (this.selected ? ' vis-selected' : '') + ' vis-readonly';
    this.dom.box.className = 'vis-item ' + className;

    if (this.data.end) {
      // turn off max-width to be able to calculate the real width
      // this causes an extra browser repaint/reflow, but so be it
      this.dom.content.style.maxWidth = 'none';
    }
  }
}

ClusterItem.prototype._getDomComponentsSizes = function () {
  return {
    previous: {
      right: this.dom.box.style.right,
      left: this.dom.box.style.left
    },
    box: {
      width: this.dom.box.offsetWidth,
      height: this.dom.box.offsetHeight
    },
  }
}

ClusterItem.prototype._updateDomComponentsSizes = function (sizes) {
  if (this.options.rtl) {
    this.dom.box.style.right = "0px";
  } else {
    this.dom.box.style.left = "0px";
  }

  // recalculate size
  if (!this.data.end) {
    this.width = sizes.box.width;
  } else {
    if (this.options.sizeToContent) {
      const contentSize = this._getContentWidth();
      this.minWidth = contentSize + contentSize * 0.1;
    } else {
      this.minWidth = sizes.box.width;
    }

    this.dom.box.style.minWidth = this.minWidth + 'px';
  }

  this.height = sizes.box.height;

  // restore previous position
  if (this.options.rtl) {
    this.dom.box.style.right = sizes.previous.right;
  } else {
    this.dom.box.style.left = sizes.previous.left;
  }

  this.dirty = false;
}

ClusterItem.prototype._repaintDomAdditionals = function () {
  this._repaintOnItemUpdateTimeTooltip(this.dom.box);
}


module.exports = ClusterItem;