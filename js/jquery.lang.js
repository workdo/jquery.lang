
var Lang = (function () {
    var Lang = function () {
        this._dynamic = {};
        this._langs = {};
    };

    Lang.prototype.attrs = [
        'title',
        'alt',
        'placeholder'
    ];

    Lang.prototype.dynamic = function (lang, path) {
        if (lang !== undefined && path !== undefined) {
            this._dynamic[lang] = path;
        }
    };

    Lang.prototype.init = function (options) {
        var self = this, cookieLang, currentLang;

        options = options || {};
        options.cookie = options.cookie || {};

        currentLang = options.currentLang;
        this.currentLang = currentLang || 'en';

        this._mutation = {
            append: $.fn.append,
            appendTo: $.fn.appendTo,
            prepend: $.fn.prepend,
            prependTo: $.fn.prependTo,
            before: $.fn.before,
            after: $.fn.after,
            html: $.fn.html
        };

        $.fn.append = function () { return self._mutationEvent(this, 'append', arguments) };
        $.fn.appendTo = function () { return self._mutationEvent(this, 'appendTo', arguments) };
        $.fn.prepend = function () { return self._mutationEvent(this, 'prepend', arguments) };
        $.fn.prependTo = function () { return self._mutationEvent(this, 'prependTo', arguments) };
        $.fn.before = function () { return self._mutationEvent(this, 'before', arguments) };
        $.fn.after = function () { return self._mutationEvent(this, 'after', arguments) };
        $.fn.html = function () { return self._mutationEvent(this, 'html', arguments) };

        $(function () {
            self._start();

            self.change(currentLang);
        });
    };

    Lang.prototype._start = function (selector) {
        var arr = selector !== undefined ? $(selector).find('[lang]') : $(':not(html)[lang]');
        var count = arr.length;
        var element;

        while (count--) {
            element = $(arr[count]);
            this._processElement(element);
        }
    };

    Lang.prototype._processElement = function (element) {
        this._storeAttributes(element);
        this._storeContent(element);
    };

    Lang.prototype._storeAttributes = function (element) {
        if(element.data('lang-attr')) return;

        var i, attr;

        var obj = element.data('lang-attr') || {};
        for (i = 0; i < this.attrs.length; i++) {
            attr = this.attrs[i];
            if (element.attr(attr)) {
                obj[attr] = element.attr(attr);
            }
        }
        element.data('lang-attr', obj);
    };

    Lang.prototype._storeContent = function (element) {
        if (element.is('input')) {
            var type = element.attr('type');
            if ((type == 'button' || type == 'submit' || type == 'hidden' || type == 'reset') && !element.data('lang-val')) {
                element.data('lang-val', element.val());
            }
        } else {
            if (element.data('lang-text')) return;
            var nodes = element.contents();

            var nodesArray = [], nodeObject = {}, node;

            for (var index = 0; index < nodes.length; index++) {
                node = nodes[index];
                if ( node.nodeType !== 3 ) {
                    continue;
                }

                nodeObject = {
                    node : node,
                    text : node.data
                };

                nodesArray.push(nodeObject);
            }

            if (nodesArray) {
                element.data('lang-text', nodesArray);
            }
        }
    };

    Lang.prototype._translateElement = function (element, lang) {
        this._translateAttributes(element, lang);
        this._translateContent(element, lang);
        element.attr('lang', lang);
    };

    Lang.prototype._translateAttributes = function (element, lang) {
        var attr, obj = element.data('lang-attr') || {}, translation;

        for (attr in obj) {
            if (element.attr(attr)) {
                translation = this.translate(obj[attr], lang);

                if (translation) {
                    element.attr(attr, translation);
                } else {
                    element.attr(attr, obj[attr]);
                }
            }
        }
    };

    Lang.prototype._translateContent = function (element, lang) {
        var translation, node, nodes, text;
        if (element.is('input')) {
            var type = element.attr('type');
            if (type == 'button' || type == 'submit' || type == 'hidden' || type == 'reset') {
                translation = this.translate(element.data('lang-val'), lang);
                if (translation) {
                    element.val(translation);
                } else {
                    element.val(element.data('lang-val'));
                }
            }
        } else {
            nodes = element.data('lang-text');
            if (nodes) {
                for (var index = 0; index < nodes.length; index++) {
                    node = nodes[index];
                    text = $.trim(node.text);

                    if (text) {
                        translation = this.translate(text, lang);

                        if (translation) {
                            try {
                                node.node.data = translation;
                            } catch (e) {
                            }
                        } else {
                            node.node.data = node.text;
                            if (console && console.log) {
                                console.log('Translation for "' + text + '" not found');
                            }
                        }
                    } else {
                        node.node.data = node.text;
                    }
                }
            }
        }
    };

    Lang.prototype._mutationEvent = function (context, method, args) {
        var result = this._mutation[method].apply(context, args);

        var element;
        if (method == "after" || method == "before") {
            element = $(context).parent();
        } else {
            element = $(context);
        }

        if (element !== undefined) {
            this._start(element);
            this.change(this.currentLang, element);
        }

        return result;
    };

    Lang.prototype.change = function (lang, selector, callback) {
        var self = this;

        if (this._langs[lang] || this._dynamic[lang]) {
            if (!this._langs[lang] && this._dynamic[lang]) {
                this.loadLang(lang, function (err) {
                    if (!err) {
                        self.change.call(self, lang, selector, callback);
                    } else {
                        if (callback) { callback('Could not load Language pack from: ' + this._dynamic[lang], lang, selector); }
                    }
                });
                return;
            } else if (!this._langs[lang] && !this._dynamic[lang]) {
                if (callback) { callback('No Language pack defined for: ' + lang, lang, selector); }
                throw('Could not change language to ' + lang + ' because no language pack loaded');
            }

            this.currentLang = lang;

            var arr = selector !== undefined ? $(selector).find('[lang]') : $(':not(html)[lang]');
            var count = arr.length, element;

            while (count--) {
                element = $(arr[count]);
                if (element.attr('lang') !== lang) {
                    this._translateElement(element, lang);
                }
            }


            //todo cookie


            if (callback) { callback(false, lang, selector); }
        } else {
            if (callback) { callback('No language pack defined for: ' + lang, lang, selector); }
            throw('Could not change language to "' + lang + '" because no language pack loaded');
        }
    };

    Lang.prototype.loadLang = function (lang, callback) {
        var self = this;

        if (lang && self._dynamic[lang]) {
            $.ajax({
                dataType: "json",
                url: self._dynamic[lang],
                success: function (data) {
                    self._langs[lang] = data;

                    if (callback) { callback(false, lang, self._dynamic[lang]); }
                },
                error: function () {
                    if (callback) { callback(true, lang, self._dynamic[lang]); }
                    throw('Error loading language file' + self._dynamic[lang]);
                }
            });
        } else {
            throw('No path specified, can not load language file for: ' + lang);
        }
    };

    Lang.prototype.translate = function (text, lang) {
        lang = lang || this.currentLang;

        if (this._langs[lang]) {
            var translation;

            translation = this._langs[lang].token[text];

            if (!translation) {
                if (console && console.log) {
                    console.log('Translation for "' + text + '" not found in language: ' + lang);
                }
            }

            return translation || text;

        } else {
            return text;
        }
    };

    Lang.prototype.refresh = function () {
        this.change(this.currentLang);
    };

    return Lang;
})();