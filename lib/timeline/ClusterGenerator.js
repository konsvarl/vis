var ClusterItem = require('./component/item/ClusterItem');

function ClusterGenerator(timeline) {
    this.timeline = timeline;
    this.clear();
};


ClusterGenerator.prototype.clear = function () {
    // cache containing created clusters for each cluster level
    this.groups = {};
    this.clearCache();
};

ClusterGenerator.prototype.createClusterItem = (itemData, conversion, options) => {
    var newItem = new ClusterItem(itemData, conversion, options);
    return newItem;
};

ClusterGenerator.prototype.clearCache = function () {
    // cache containing created clusters for each cluster level
    this.cache = {};
    this.cacheLevel = -1;
    this.cache[this.cacheLevel] = [];
};

// ClusterGenerator.prototype.setData = function (items, options) {
//   this.dataChanged = true;
//   this.applyOnChangedLevel = true;
//   if (options && options.applyOnChangedLevel) {
//       this.applyOnChangedLevel = options.applyOnChangedLevel;
//   }
// };


ClusterGenerator.prototype.updateData = function (options) {
    this.dataChanged = true;
    //this.applyOnChangedLevel = false;
    this.applyOnChangedLevel = true;
    if (options && options.applyOnChangedLevel) {
        this.applyOnChangedLevel = options.applyOnChangedLevel;
    }
};

ClusterGenerator.prototype.filterData = function () {
    // filter per group
    var groups = {};
    this.groups = groups;

    // split the items per group
    for (const item of Object.values(this.timeline.itemSet.items)) {
        // put the item in the correct group
        var groupName = item.parent ? item.parent.groupId : '';
        var group = groups[groupName];
        if (!group) {
            group = [];
            groups[groupName] = group;
        }
        group.push(item);

        // calculate the center of the item
        if (item.data.start) {
            if (item.data.end) {
                // range
                item.center = (item.data.start.valueOf() + item.data.end.valueOf()) / 2;
            } else {
                // box, dot
                item.center = item.data.start.valueOf();
            }
        }
    }

    // sort the items per group
    for (var groupName in groups) {
        if (groups.hasOwnProperty(groupName)) {
            groups[groupName].sort(function (a, b) {
                return (a.center - b.center);
            });
        }
    }

    this.dataChanged = false;
};

ClusterGenerator.prototype.getClusters = function (scale, options) {
    let { maxItems, titleTemplate, clusterCriteria } = options;
    if (!clusterCriteria) {
        clusterCriteria = () => true;
    }
    maxItems = maxItems || 1;
    titleTemplate = titleTemplate || '';

    let level = -1;
    let granularity = 2;
    let timeWindow = 0;

    if (scale > 0) {
        if (scale >= 1) {
            return [];
        }
        
        level = Math.abs(Math.round(Math.log(100 / scale) / Math.log(granularity)));
        timeWindow = Math.abs(Math.pow(granularity, level));
    }

    // clear the cache when and re-filter the data when needed.
    if (this.dataChanged) {
        var levelChanged = (level != this.cacheLevel);
        var applyDataNow = this.applyOnChangedLevel ? levelChanged : true;
        if (applyDataNow) {
            this.clearCache();
            this.filterData();
        }
    }

    this.cacheLevel = level;
    var clusters = this.cache[level];
    if (!clusters) {
        clusters = [];

        // TODO: spit this method, it is too large
        for (var groupName in this.groups) {
            if (this.groups.hasOwnProperty(groupName)) {
                var items = this.groups[groupName];
                var iMax = items.length;
                var i = 0;
                while (i < iMax) {
                    // find all items around current item, within the timeWindow
                    var item = items[i];
                    var neighbors = 1; // start at 1, to include itself)

                    // loop through items left from the current item
                    var j = i - 1;
                    while (j >= 0 && (item.center - items[j].center) < timeWindow / 2) {
                        if (!items[j].cluster && clusterCriteria(item.data, items[j].data)) {
                            neighbors++;
                        }
                        j--;
                    }

                    // loop through items right from the current item
                    var k = i + 1;
                    while (k < items.length && (items[k].center - item.center) < timeWindow / 2) {
                        if (clusterCriteria(item.data, items[k].data)) {
                            neighbors++;
                        }
                        k++;
                    }

                    // loop through the created clusters
                    var l = clusters.length - 1;
                    while (l >= 0 && (item.center - clusters[l].center) < timeWindow) {
                        if (item.group == clusters[l].group && clusterCriteria(item.data, clusters[l].data)) {
                            neighbors++;
                        }
                        l--;
                    }

                    // aggregate until the number of items is within maxItems
                    if (neighbors > maxItems) {
                        // too busy in this window.
                        var num = neighbors - maxItems + 1;
                        var clusterItems = [];

                        // append the items to the cluster,
                        // and calculate the average start for the cluster
                        let count = 0;
                        let m = i;
                        while (clusterItems.length < num && m < items.length) {
                            clusterItems.push(items[m]);
                            count++;
                            m++;
                        }

                        var title = titleTemplate.replace(/{count}/, count);
                        var content = '<div title="' + title + '">' + count + '</div>';

                        var groupId = this.timeline.itemSet.getGroupId(item.data);
                        var group = this.timeline.itemSet.groups[groupId];
                        const conversion = {
                            toScreen: this.timeline.body.util.toScreen,
                            toTime: this.timeline.body.util.toTime
                        };
                        const clusterOptions = Object.assign({}, options, this.timeline.itemSet.options);
                        const cluster = this.createClusterItem({
                                'content': content,
                                'title': title,
                                'group': group,
                                'items': clusterItems,
                                'eventEmitter': this.timeline.body.emitter
                            },
                            conversion,
                            clusterOptions);

                        if (group) {
                            group.add(cluster, false);
                        }

                        cluster.items.forEach(function (item) {
                            item.cluster = cluster;
                        });

                        clusters.push(cluster);
                        i += num;
                    } else {
                        delete item.cluster;
                        i += 1;
                    }
                }
            }
        }

        this.cache[level] = clusters;
    }

    return clusters;
};

module.exports = ClusterGenerator;