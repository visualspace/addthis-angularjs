/**
 * @license official-addthis-angularjs 1.0.3
 * Copyright (c) 2017 Oracle and/or its affiliates.
 * License: UPL
 */
var addthisModule = (function(window, angular) {
    // Variable for tracking whether `addthis_widget.js will be auto added onto
    // the page if app author does not manually add it.
    var autoAddScript = true;

    // Variable for tracking whether the `addthis_widget.js` is added towards
    // the top of the DOM (appended onto the HEAD element) or to the
    // bottom/footer (appended onto the BODY element). For footer, it will be
    // `true`, for header it will be `false`.
    var scriptInFooter = true;

    // Variable for tracking the profile ID for the site
    var profileId = false;

    // Variable fro tracking the provided `addthis_config` settings before
    // `addthis_widget.js` has a chance to change them. For documentation on
    // `addthis_config` see
    // https://www.addthis.com/academy/the-addthis_config-variable/
    var addthis_config = {};

    // Variable for tracking the provided `addthis_share` settings before
    // `addthis_widget.js` has a chance to change them. For documentation on
    // `addthis_config` see
    // https://www.addthis.com/academy/the-addthis_share-variable/
    var addthis_share = {};

    // Variable for tracking module usage to help guide AddThis in deciding how
    // many resources to devote to maintaining this integration and what
    // versions of Angular to focus on or test with.
    var addthis_plugin_info = {
        info_status    : 'enabled',
        cms_name       : 'Angular',
        plugin_name    : 'official-addthis-angularjs',
        plugin_version : '1.0.3',
        plugin_mode    : 'AddThis'
    };

    addthis_plugin_info.cms_version = angular.version.full;

    var defaultUrl = 'https://s7.addthis.com/js/300/addthis_widget.js';
    var baseUrl = defaultUrl;

    /*
     * @private
     * @description
     * Checks if AddThis' `addthis_widget.js` script is on page
     *
     * @param {object} document The Document interface represents any web page
     * loaded in the browser and serves as an entry point into the web page's
     * content.
     * @returns {boolean} true if the script is on the page, false if it is not
     **/
    var checkForScript = function(document) {
        var scriptOnPage = false;
        var selector = 'script[src*="addthis_widget.js"]';
        var matches = document.querySelectorAll(selector);
        if(matches.length > 0) {
            scriptOnPage = true;
        }
        return scriptOnPage;
    };

    /*
     * @private
     * @description
     * Adds AddThis's `addthis_widget.js` script onto the page if it's not
     * already present
     *
     * @param {object} document The Document interface represents any web page
     * loaded in the browser and serves as an entry point into the web page's
     * content.
     **/
    var addScript = function(document) {
        // if script is already on page, do nothing
        if (checkForScript(document)) {
            return;
        }

        var url;

        if(profileId) {
            // preference the site's profile ID in the URL, if available
            url = baseUrl + '#pubid=' + profileId;
        } else {
            url = baseUrl;
        }

        // create SCRIPT element
        var script = document.createElement('script');
        script.src = url;

        // append SCRIPT element

        if(scriptInFooter !== true && typeof document.head === 'object') {
            document.head.appendChild(script);
        } else {
            document.body.appendChild(script);
        }
    };

    // Object for tracking whether a smartLayers refresh is pending and the
    // last timestamp when one was requested (lastTs). Used in
    // queueSmartLayersRefresh.
    var smartLayersRefreshRequest = {
        pending: false
    };

    /*
     * @private
     * @description
     * Checks if `addthis_widget.js` is loaded yet and whether SmartLayers has
     * initialized. If not, there's no need to bother with
     * `addthis.layers.refresh`. If present, creates an interval promise for
     * 100ms to make sure more refresh requests aren't coming still coming in
     * from the app very soon. If no more refresh requests have come in, and
     * refresh hasn't been called in 500ms, `addthis.layers.refresh` is
     * executed. FYI: AddThis SmartLayers API will ignore calls to
     * `addthis.layers.refresh` if it's been called already within 500ms.
     *
     * @param {object} $window The window object represents a window containing a
     *   DOM document
     * @param {object} $interval Angular's wrapper for `window.setInterval`
     **/
    var queueSmartLayersRefresh = function($window, $interval) {
        smartLayersRefreshRequest.lastTs = (new Date()).getTime();

        $window.addthis_config = angular.copy(addthis_config);
        $window.addthis_share = angular.copy(addthis_share);

        // if `addthis.layers.refresh` doesn't exist yet, do nothing
        // FYI: `addhtis.layers.refresh` won't exist until SmartLayers has
        // bootstrapped. It won't bootstrap automatically unless it's loaded
        // with a valid profile ID that has a tool configured on
        // https://www.addthis.com/dashboard
        if (smartLayersRefreshRequest.pending ||
            typeof $window.addthis === 'undefined' ||
            typeof $window.addthis.layers === 'undefined' ||
            typeof $window.addthis.layers.refresh === 'undefined'
        ) {
            return;
        }

        smartLayersRefreshRequest.pending = true;
        var intervalPromise;

        var checkAndRun = function() {
            var now = (new Date()).getTime();
            // if it's been at least 99ms since the last request
            // and it's been more than 500ms since client did a layers
            // refresh (client won't do it more often anyway)
            if (now - smartLayersRefreshRequest.lastTs >= 100 &&
                now - $window.addthis.layers.lastViewRegistered > 500
            ) {
                $interval.cancel(intervalPromise);
                smartLayersRefreshRequest.pending = false;
                $window.addthis.layers.refresh(
                    addthis_share.url,
                    addthis_share.title
                );
            }
        };

        intervalPromise = $interval(checkAndRun, 100, 0, false);
    };

    /*
     * @private
     * @description
     * Sets the `addthis_config` variable on the page. If the pubid is set it
     * take it an use it elsewhere. Otherwise, it will add in the previously set
     * profile ID (if set) to `addthis_config.pubid`. See
     * <a href="https://www.addthis.com/academy/the-addthis_config-variable/" target="_blank">
     * the addthis_config variable documentation</a> for options.
     *
     * @param {object} input AddThis configuration object. See
     *   <a href="https://www.addthis.com/academy/the-addthis_config-variable/" target="_blank">
     *   the addthis_config variable documentation</a> for options.
     * @returns {object} a copy of the `addthis_config` variable on the
     *   page with an added pubid property if it wasn't set in the input
     *   and a profile ID was set elsewhere
     **/
    var setAddThisConfig = function(input) {
        if (typeof input === 'object') {
            if (input.pubid) {
                // grab the profile ID for reuse, if provided this way
                profileId = input.pubid;
            }

            // `addthis_config.ignore_server_config` means profile ID settings
            // will be ignored.
            if (input.ignore_server_config) {
                addthis_plugin_info.plugin_mode = 'Local';
            } else {
                addthis_plugin_info.plugin_mode = 'AddThis';
            }

            addthis_config = angular.copy(input);

            if (profileId) {
                addthis_config.pubid = profileId;
            }
        }

        return angular.copy(addthis_config);
    };

    /*
     * @private
     * @description
     * Sets the `addthis_share` variable on the page. See
     * <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
     *   the addthis_share variable documentation</a> for options.
     *
     * @param {object} input AddThis sharing options. See
     *   <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
     *   the addthis_share variable documentation</a> for options.
     * @returns {object} a copy of the `addthis_share` variable on the page
     **/
    var setAddThisShare = function(input) {
        if (typeof input === 'object') {
            addthis_share = angular.copy(input);
        }

        return angular.copy(addthis_share);
    };

    /*
     * @private
     * @description
     * Sets the URL shared by tools that don't explicitly set one through the
     * `data-url` attribute. This is a shortcut to adding the URL into
     * `addthis_share.url`. See
     * <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
     * the addthis_share variable documentation</a> for
     * more information on `addthis_share`. If not set here or in the `data-url`
     * attribute, the browsers URL will be used when sharing.
     *
     * @param {string} url The URL to share when a user clicks on a share
     *   buttons that don't otherwise speicfy a share URL
     **/
    var setShareUrl = function(url) {
        addthis_share.url = url;
    };

    /*
     * @private
     * @description
     * Sets the title shared by tools that don't explicitly set one through the
     * `data-title` attribute. This is a shortcut to adding the title into
     * `addthis_share.title`. See
     * <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
     * the addthis_share variable documentation</a> for
     * more information on `addthis_share`. If not set here or in the
     * `data-title` attribute, the document title will be used when sharing.
     *
     * @param {string} title The title to share when a user clicks on a share
     *   buttons that don't otherwise speicfy a share title
     **/
    var setShareTitle = function(title) {
        addthis_share.title = title;
    };

    /*
     * @private
     * @description
     * Sets the description shared by tools that don't explicitly set one
     * through the `data-description` attribute. This is a shortcut to adding
     * the description into `addthis_share.description`. See
     * <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
     * the addthis_share variable documentation</a> for
     * more information on `addthis_share`.
     *
     * @param {string} description The description to share when a user
     *   clicks on a share buttons that don't otherwise speicfy a share
     *   description
     **/
    var setShareDescription = function(description) {
        addthis_share.description = description;
    };

    /*
     * @private
     * @description
     * Sets the image shared by tools that don't explicitly set one through the
     * `data-media` attribute. This is a shortcut to adding the image into
     * `addthis_share.media`. See
     * <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
     * the addthis_share variable documentation</a> for
     * more information on `addthis_share`.
     *
     * @param {string} media The image to share when a user clicks on a share
     *   buttons that don't otherwise speicfy a share image
     **/
    var setShareMedia = function(media) {
        addthis_share.media = media;
    };

    // Variable for tracking script loading information.
    var load = {
        promise: false,
        interval: 200
    };

    /*
     * @private
     * @description
     * Returns a promise that resolves once AddThis' `addthis_widget.js`
     * loaded and is ready to use.
     *
     * @param {object} $window The window object represents a window containing a
     *   DOM document;
     * @param {object} $q Angular's promise implementation
     * @param {object} $interval Angular's wrapper for `window.setInterval`
      **/
    var scriptLoaded = function($window, $q, $interval) {
        if(load.promise) {
            return load.promise;
        }
        var deferred = $q.defer();

        if($window.addthis) {
            deferred.resolve($window.addthis);
        } else {
            var addThisCheckPromise = $interval(
                function() {
                    if($window.addthis) {
                        $interval.cancel(addThisCheckPromise);
                        load.done = true;
                        deferred.resolve($window.addthis);
                    }
                },
                load.interval,
                0,
                false
            );
        }

        load.promise = deferred.promise;
        return load.promise;
    };

    scriptLoaded.$inject = ['$window', '$q', '$interval'];

    /*
     * @private
     * @description
     * Takes a twitter handle/username and uses it for twitter via. See
     * https://www.addthis.com/academy/changes-to-how-twitter-works-with-addthis/
     * for more information
     *
     * @param {string|false} the twitter handle in a string or false to remove
     * twitter handle from config
     **/
    var twitterVia = function(handle) {
        if (typeof handle === 'string' && handle.length > 0) {
            if (typeof addthis_share.passthrough === 'undefined') {
                addthis_share.passthrough = {};
            }
            if (typeof addthis_share.passthrough.twitter === 'undefined') {
                addthis_share.passthrough.twitter = {};
            }
            addthis_share.passthrough.twitter.via = handle;
        } else if (handle === false &&
            typeof addthis_share.passthrough !== 'undefined' &&
            typeof addthis_share.passthrough.twitter !== 'undefined' &&
            typeof addthis_share.passthrough.twitter.via !== 'undefined'
        ) {
            delete addthis_share.passthrough.twitter.via;
        }
    };

    /*
     * @private
     * @description
     * Takes a URL shortening name and a social service name, then enables URL
     * shortening on that social service using the url shortening service.
     * https://www.addthis.com/academy/url-shortening/
     * for more information
     *
     * @param {string} urlShorteningService The URL shortening service to enable
     * @param {string} socialService The social service to enable the URL shortening on
     **/
    var urlShortening = function(urlShorteningService, socialService) {
        if (typeof addthis_share.url_transforms === 'undefined') {
            addthis_share.url_transforms = {};
        }
        if (typeof addthis_share.url_transforms.shorten === 'undefined') {
            addthis_share.url_transforms.shorten = {};
        }
        if (typeof addthis_share.shorteners === 'undefined') {
            addthis_share.shorteners = {};
        }

        addthis_share.url_transforms.shorten[socialService] = urlShorteningService;
        addthis_share.shorteners[urlShorteningService] = {};
    };

    /**
     * @ngdoc service
     * @name addthis.$addthis
     *
     * @description
     * A service for handling AddThis actions once your app is running.
     **/
    var addthisService = function($window, $q, $interval) {
        // resetting when bootstrapping the serivce... for unit tests
        load.promise = false;
        smartLayersRefreshRequest.pending = false;
        smartLayersRefreshRequest.lastTs = 0;

        var service = {
            /**
             * @ngdoc method
             * @name addthis.$addthis#add
             * @methodOf addthis.$addthis
             *
             * @description
             * Adds the `addthis_widget.js` script onto the page if not
             * already present. Note: `addthis_widget.js` will automatically be
             * added to your page unless turned off using
             * `$addthisProvider.disableAutoAdd`.
             *
             * @example
             * ```js
             * app.controller('AcceptCookiesCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     $scope.userAccepts = function() {
             *         $service.add();
             *     };
             * }]);
             * ```
             **/
            add: function() {
                addScript($window.document);
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#layersRefresh
             * @methodOf addthis.$addthis
             *
             * @description
             * Applys new values from `addthis_config` and `addthis_share`,
             * updates the share url and title where not explicitly set and
             * reloads AddThis floating tools.
             *
             * This module will catch most of the situations where AddThis'
             * SmartLayers API needs to be refreshed. However, there may be
             * some times siutations where the devleoper must call this
             * directly, such as:
             *  <ul>
             *   <li>changing the document title without a location/route/state changes (where the share title on floating should reflect thge document title)</li>
             *   <li>adding inline tools onto pages without using the addthisTool directive</li>
             * </ul>
             *
             * @example
             * ```js
             * app.controller('AccountPageCtrl', ['$scope', '$addthis', '$window', function($scope, $addthis, $window) {
             *     $window.document.title = 'Account Page';
             *     $addthis.layersRefresh();
             * }]);
             * ```
             **/
            layersRefresh: function() {
                queueSmartLayersRefresh($window, $interval);
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#config
             * @methodOf addthis.$addthis
             *
             * @description
             * Sets the `addthis_config` variable on the page. If the pubid is set it
             * take it an use it elsewhere. Otherwise, it will add in the previously set
             * profile ID (if set) to `addthis_config.pubid`. See
             * <a href="https://www.addthis.com/academy/the-addthis_config-variable/" target="_blank">
             * the addthis_config variable documentation</a> for options.
             *
             * @example
             * ```js
             * app.controller('DoNotPrintOrEmailMeCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     var cfg = {
             *         'services_exclude': 'print,mailto',
             *         'ui_language': 'pl',
             *         'data_track_clickback': false,
             *         'ui_508_compliant': true
             *     };
             *     $addthis.config(cfg);
             * }]);
             * ```
             *
             * @param {object} input AddThis configuration object. See
             *   <a href="https://www.addthis.com/academy/the-addthis_config-variable/" target="_blank">
             *   the addthis_config variable documentation</a> for options.
             * @returns {object} a copy of the `addthis_config` variable on the
             *   page with an added pubid property if it wasn't set in the input
             *   and a profile ID was set elsewhere
             **/
            config: function(input) {
                var configCopy = setAddThisConfig(input);
                queueSmartLayersRefresh($window, $interval);
                return configCopy;
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#share
             * @methodOf addthis.$addthis
             *
             * @description
             * Sets the `addthis_share` variable on the page. See
             * <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
             * the addthis_share variable documentation</a> for options.
             *
             * @example
             * ```js
             * app.controller('AddThisInfoCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     var share_info = {
             *         'url': 'https://www.addthis.com',
             *         'passthrough': {
             *             'twitter': {
             *                 'via': 'TWITTER USERNAME'
             *             }
             *         }
             *     };
             *     $addthis.share(share_info);
             * }]);
             * ```
             *
             * @param {object} input AddThis configuration object. See
             *   <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
             *   the addthis_share variable documentation</a> for options.
             * @returns {object} a copy of the `addthis_share` variable on the
             *   page
             **/
            share: function(input) {
                var shareCopy = setAddThisShare(input);
                queueSmartLayersRefresh($window, $interval);
                return shareCopy;
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#shareUrl
             * @methodOf addthis.$addthis
             *
             * @description
             * This is a shortcut to setting the URL through
             * `$addthis.share({'url': 'http://example.com'})`. Sets the URL
             * shared by tools that don't explicitly set one. With the
             * `addthisTool` directive, you may set the URL explicitly using
             * the `share-url` attribute. If not set otherwise, the browsers URL
             * will be used when sharing.
             *
             * To reset to default, set to `false`.
             *
             * @example
             * ```js
             * app.controller('AddThisInfoCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     $addthis.shareUrl('https://www.addthis.com');
             * }]);
             * ```
             *
             * @param {string} url The URL to share when a user clicks on share
             *   buttons that don't otherwise speicfy a share URL
             * @returns {mixed} a copy of the `addthis_share` url variable on
             * the page, usually a string
             **/
            shareUrl: function(url) {
                if (typeof url !== 'undefined') {
                    setShareUrl(url);
                    queueSmartLayersRefresh($window, $interval);
                }
                return addthis_share.url;
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#shareTitle
             * @methodOf addthis.$addthis
             *
             * @description
             * This is a shortcut to setting the title through
             * `$addthis.share({'title': 'Check this out!'})`. Sets the title
             * shared by tools that don't explicitly set one. With the
             * `addthisTool` directive, you may set the title explicitly using
             * the `share-title` attribute. If not set otherwise, the
             * document's title will be used when sharing.
             *
             * To reset to default, set to `false`.
             *
             * Note: Some services (such as Facebook) do not allow you to define
             * the share title for a URL this way. Facebook will always use the
             * Open Graph tags it finds on the page when it crawls it. You can
             * use the <a href="https://developers.facebook.com/tools/debug/">
             * Facebook Sharing Debugger</a> to test your Open Graph tags.
             *
             * @example
             * ```js
             * app.controller('DoMagicCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     $addthis.shareTitle('Check this out!');
             * }]);
             * ```
             *
             * @param {string} title The title to share when a user clicks on share
             *   buttons that don't otherwise speicfy a share title
             * @returns {mixed} a copy of the `addthis_share` title variable on
             * the page, usually a string
             **/
            shareTitle: function(title) {
                if (typeof title !== 'undefined') {
                    setShareTitle(title);
                    queueSmartLayersRefresh($window, $interval);
                }
                return addthis_share.title;
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#shareDescription
             * @methodOf addthis.$addthis
             *
             * @description
             * This is a shortcut to setting the description through
             * `$addthis.share({'description': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'})`\
             * . Sets the description shared by tools that don't explicitly set
             * one. With the `addthisTool` directive, you may set the
             * description explicitly using the `share-description` attribute.
             *
             * To reset to default, set to `false`.
             *
             * Note: Some services (such as Facebook) do not allow you to define
             * the share description for a URL this way. Facebook will always
             * use the Open Graph tags it finds on the page when it crawls it.
             * You can use the
             * <a href="https://developers.facebook.com/tools/debug/">
             * Facebook Sharing Debugger</a> to test your Open Graph tags.
             *
             * @example
             * ```js
             * app.controller('DoMagicCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     $addthis.shareDescription('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
             * }]);
             * ```
             *
             * @param {string} description The description to share when a user
             *   clicks on share buttons that don't otherwise speicfy a share
             *   description
             * @returns {mixed} a copy of the `addthis_share` description
             * variable on the page, usually a string
             **/
            shareDescription: function(description) {
                if (typeof description !== 'undefined') {
                    setShareDescription(description);
                    queueSmartLayersRefresh($window, $interval);
                }
                return addthis_share.description;
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#shareMedia
             * @methodOf addthis.$addthis
             *
             * @description
             * This is a shortcut to setting the image through
             * `$addthis.share({'shareMedia': 'http://example.com/img.png'})`.
             * Sets the image shared by tools that don't explicitly set one.
             * With the `addthisTool` directive, you may set the image
             * explicitly using the `share-media` attribute.
             *
             * To reset to default, set to `false`.
             *
             * Note: Some services (such as Facebook) do not allow you to define
             * the share image for a URL this way. Facebook will always use the
             * Open Graph tags it finds on the page when it crawls it. You can
             * use the <a href="https://developers.facebook.com/tools/debug/">
             * Facebook Sharing Debugger</a> to test your Open Graph tags.
             *
             * @example
             * ```js
             * app.controller('DoMagicCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     $addthis.shareMedia('http://example.com/img.png');
             * }]);
             * ```
             *
             * @param {string} media The image to share when a user clicks on share
             *   buttons that don't otherwise speicfy a share image
             * @returns {mixed} a copy of the `addthis_share` media variable on
             * the page, usually a string
             **/
            shareMedia: function(media) {
                if (typeof media !== 'undefined') {
                    setShareMedia(media);
                    queueSmartLayersRefresh($window, $interval);
                }
                return addthis_share.media;
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#twitterVia
             * @methodOf addthis.$addthis
             *
             * @description
             * Takes a twitter handle/username and uses it for twitter via. See
             * https://www.addthis.com/academy/changes-to-how-twitter-works-with-addthis/
             * for more information
             *
             * @example
             * ```js
             * app.controller('DoMagicCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     $addthis.twitterVia('addthis');
             * }]);
             * ```
             *
             * @param {string|false} the twitter handle in a string or false to remove
             * twitter handle from config
             **/
            twitterVia: function(handle) {
                twitterVia(handle);
                queueSmartLayersRefresh($window, $interval);
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#urlShortening
             * @methodOf addthis.$addthis
             *
             * @description
             * Takes a URL shortening name and a social service name, then enables URL
             * shortening on that social service using the url shortening service.
             * https://www.addthis.com/academy/url-shortening/
             * for more information
             *
             * @example
             * ```js
             * app.controller('DoMagicCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     $addthis.urlShortening('bitly', 'twitter');
             * }]);
             * ```
             *
             * @param {string} urlShorteningService The URL shortening service to enable
             * @param {string} socialService The social service to enable the URL shortening on
             **/
            urlShortening: function(urlShorteningService,socialService) {
                urlShortening(urlShorteningService,socialService);
                queueSmartLayersRefresh($window, $interval);
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#loaded
             * @methodOf addthis.$addthis
             *
             * @description
             * Returns a promise that resolves once AddThis' `addthis_widget.js`
             * loaded and is ready to use.
             *
             * @example
             * ```js
             * app.controller('LoadMoreCatsCtrl', ['$scope', '$addthis', function($scope, $addthis) {
             *     $addthis.loaded().then(function() {
             *         // addthis_widget.js has loaded
             *     });
             * }]);
             * ```
             *
             * @returns {promise} A promise that resolves once `addthis_widget.js`
             * loaded
             **/
            loaded: function() {
                return scriptLoaded($window, $q, $interval);
            },
            /**
             * @ngdoc method
             * @name addthis.$addthis#profileId
             * @methodOf addthis.$addthis
             *
             * @description
             * Returns the profile id used on this site
             *
             * @returns {string|boolen} false if no profile id set
             **/
            profileId: function() {
                return profileId;
            }
        };

        return service;
    };


    addthisService.$inject = ['$window', '$q', '$interval'];


    /**
     * @ngdoc service
     * @name addthis.$addthisProvider
     * @description
     * A provider for handling AddThis actions before you app has started
     * running.
     **/
    var addthisProvider = function($windowProvider) {
        var window = $windowProvider.$get();
        if (typeof window.addthis_config === 'object') {
            addthis_config = angular.copy(window.addthis_config);
        }

        if (window.addthis_share) {
            addthis_share = angular.copy(window.addthis_share);

            if (window.addthis) {
                /* If addthis_widget has already set up the global addthis variable
                 * by now, then the url and title properties may have been set
                 * by it and not on page. Let's not hold on to it.
                 **/
                if (addthis_share.url) {
                    delete addthis_share.url;
                }

                if (addthis_share.title) {
                    delete addthis_share.title;
                }

                if (addthis_share.description) {
                    delete addthis_share.description;
                }

                if (addthis_share.media) {
                    delete addthis_share.media;
                }
            }
        }

        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#profileId
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * Setter function for the site's AddThis profile ID.
         *
         * If the site's profile ID is set somehow through the `addthisProvider`
         * (such as here), then adding addthis_widget.js manually onto your
         * page is optional.
         *
         * @example
         * ```js
         * app.config(function($addthisProvider) {
         *     $addthisProvider.profileId('your_profile_id_here');
         * });
         * ```
         *
         * @param {string} input The AddThis profile ID to use on this
         *   site.
         * @returns {boolean|string} Returns the profile id or false if not set
         **/
        this.profileId = function(input) {
            if (typeof input !== 'undefined') {
                profileId = input;
                addthis_config.pubid = input;
            }
            return profileId;
        };

        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#config
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * Sets the `addthis_config` variable on the page. If the pubid is set
         * it take it an use it elsewhere. Otherwise, it will add in the
         * previously set profile ID (if set) to `addthis_config.pubid`. See
         * <a href="https://www.addthis.com/academy/the-addthis_config-variable/" target="_blank">
         * the addthis_config variable documentation</a> for options.
         *
         * If the site's profile ID is set somehow through the `addthisProvider`
         * (such as here), then adding addthis_widget.js manually onto your
         * page is optional.
         *
         * @example
         * ```js
         * app.config(function($addthisProvider) {
         *     var cfg = {
         *         'services_exclude': 'print,mailto',
         *         'ui_language': 'pl',
         *         'data_track_clickback': false,
         *         'ui_508_compliant': true,
         *         'pubid': 'your_profile_id_here'
         *     };
         *     $addthisProvider.config(cfg);
         * });
         * ```
         *
         * @param {object} input AddThis configuration object. See
         *   <a href="https://www.addthis.com/academy/the-addthis_config-variable/" target="_blank">
         *   the addthis_config variable documentation</a> for options.
         * @returns {object} Returns addthis general configuration object
         **/
        this.config = function(input) {
            var configCopy = setAddThisConfig(input);
            return configCopy;
        };

        /**
         * @description
         * Sets the `addthis_share` variable on the page. See
         * <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
         * the addthis_share variable documentation</a> for options.
         *
         * @example
         * ```js
         * app.config(function($addthisProvider) {
         *     var share_info = {
         *         'url': 'https://www.addthis.com',
         *         'passthrough': {
         *             'twitter': {
         *                 'via': 'TWITTER USERNAME'
         *             }
         *         }
         *     };
         *     $addthisProvider.share(share_info);
         * });
         * ```
         *
         * @param {object} input AddThis share object. See
         *   <a href="https://www.addthis.com/academy/the-addthis_share-variable/" target="_blank">
         *   the addthis_share variable documentation</a> for options.
         * @returns {object} Returns addthis share configuration object
         **/
        this.share = function(input) {
            var shareCopy = setAddThisShare(input);
            return shareCopy;
        };

       /**
         * @ngdoc method
         * @name addthis.$addthisProvider#shareUrl
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * This is a shortcut to setting the URL through
         * `$addthisProvider.share({'url': 'http://example.com'})`. Sets the URL
         * shared by tools that don't explicitly set one. With the
         * `addthisTool` directive, you may set the URL explicitly using
         * the `share-url` attribute. If not set otherwise, the browsers URL
         * will be used when sharing.
         *
         * To reset to default, set to `false`.
         *
         * ```js
         * app.config(function($addthisProvider) {
         *     $addthisProvider.shareUrl('https://www.addthis.com');
         * });
         * ```
         *
         * @param {string} url The URL to share when a user clicks on share
         *   buttons that don't otherwise speicfy a share URL
         * @returns {mixed} a copy of the `addthis_share` url variable on
         * the page, usually a string
         **/
        this.shareUrl = function(url) {
            if (typeof url !== 'undefined') {
                setShareUrl(url);
            }
            return addthis_share.url;
        };

        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#shareTitle
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * This is a shortcut to setting the title through
         * `$addthisProvider.share({'title': 'Check this out!'})`. Sets the
         * title shared by tools that don't explicitly set one. With the
         * `addthisTool` directive, you may set the URL explicitly using
         * the `share-title` attribute. If not set otherwise, the
         * document's title will be used when sharing.
         *
         * To reset to default, set to `false`.
         *
         * Note: Some services (such as Facebook) do not allow you to define
         * the share title for a URL this way. Facebook will always use the
         * Open Graph tags it finds on the page when it crawls it. You can
         * use the <a href="https://developers.facebook.com/tools/debug/">
         * Facebook Sharing Debugger</a> to test your Open Graph tags.
         *
         * ```js
         * app.config(function($addthisProvider) {
         *     $addthisProvider.shareTitle('Check this out!');
         * });
         * ```
         *
         * @param {string} url The URL to share when a user clicks on share
         *   buttons that don't otherwise speicfy a share URL
         * @returns {mixed} a copy of the `addthis_share` title variable on
         * the page
         **/
        this.shareTitle = function(title) {
            if (typeof title !== 'undefined') {
                setShareTitle(title);
            }
            return addthis_share.title;
        };
        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#shareDescription
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * This is a shortcut to setting the description through
         * `$addthis.share({'description': 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'})`\
         * . Sets the description shared by tools that don't explicitly set
         * one. With the `addthisTool` directive, you may set the
         * description explicitly using the `share-description` attribute.
         *
         * To reset to default, set to `false`.
         *
         * Note: Some services (such as Facebook) do not allow you to define
         * the share description for a URL this way. Facebook will always
         * use the Open Graph tags it finds on the page when it crawls it.
         * You can use the
         * <a href="https://developers.facebook.com/tools/debug/">
         * Facebook Sharing Debugger</a> to test your Open Graph tags.
         *
         * ```js
         * app.config(function($addthisProvider) {
         *     $addthisProvider.shareDescription('Lorem ipsum dolor sit amet, consectetur adipiscing elit.');
         * });
         * ```
         *
         * @param {string} description The description to share when a user
         *   clicks on share buttons that don't otherwise speicfy a share
         *   description
         * @returns {mixed} a copy of the `addthis_share` description
         * variable on the page, usually a string
         **/
        this.shareDescription = function(description) {
            if (typeof description !== 'undefined') {
                setShareDescription(description);
            }
            return addthis_share.description;
        };
        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#shareMedia
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * This is a shortcut to setting the image through
         * `$addthis.share({'shareMedia': 'http://example.com/img.png'})`.
         * Sets the image shared by tools that don't explicitly set one.
         * With the `addthisTool` directive, you may set the image
         * explicitly using the `share-media` attribute.
         *
         * To reset to default, set to `false`.
         *
         * Note: Some services (such as Facebook) do not allow you to define
         * the share image for a URL this way. Facebook will always use the
         * Open Graph tags it finds on the page when it crawls it. You can
         * use the <a href="https://developers.facebook.com/tools/debug/">
         * Facebook Sharing Debugger</a> to test your Open Graph tags.
         *
         * ```js
         * app.config(function($addthisProvider) {
         *     $addthisProvider.shareMedia('http://example.com/img.png');
         * });
         * ```
         *
         * @param {string} media The image to share when a user clicks on share
         *   buttons that don't otherwise speicfy a share image
         * @returns {mixed} a copy of the `addthis_share` media variable on
         * the page, usually a string
         **/
        this.shareMedia = function(media) {
            if (typeof media !== 'undefined') {
                setShareMedia(media);
            }
            return addthis_share.media;
        };
        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#twitterVia
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * Takes a twitter handle/username and uses it for twitter via. See
         * https://www.addthis.com/academy/changes-to-how-twitter-works-with-addthis/
         * for more information
         *
         * @example
         * ```js
         * app.config(function($addthisProvider) {
         *     $addthisProvider.twitterVia('addthis');
         * });
         * ```
         *
         * @param {string|false} the twitter handle in a string or false to remove
         * twitter handle from config
         **/
        this.twitterVia = function(handle) {
            twitterVia(handle);
        };
        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#urlShortening
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * Takes a URL shortening name and a social service name, then enables URL
         * shortening on that social service using the url shortening service.
         * https://www.addthis.com/academy/url-shortening/
         * for more information
         *
         * @example
         * ```js
         * app.config(function($addthisProvider) {
         *     $addthisProvider.urlShortening('bitly', 'twitter');
         * });
         * ```
         *
         * @param {string} urlShorteningService The URL shortening service to enable
         * @param {string} socialService The social service to enable the URL shortening on
         **/
        this.urlShortening = function(urlShorteningService, socialService) {
            urlShortening(urlShorteningService,socialService);
        };
        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#disableAutoAdd
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * If not added onto the page manually, this module automatically adds
         * `addthis_widget.js` onto the site (if not added manually). Calling
         * this function will disable this functionality. The
         * `addthis_widget.js` script can be added later by calling
         * `$addthis.add`. AddThis tools will not function until
         * `addthis_widget.js` is added onto the page.
         *
         * ```js
         * app.config(function($addthisProvider) {
         *     $addthisProvider.disableAutoAdd();
         * });
         * ```
         *
         * @returns {addthisProvider object} Returns the $addthisProvider object
         **/
        this.disableAutoAdd = function() {
            autoAddScript = false;
            return this;
        };

        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#enableAutoAdd
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * By default, this module automatically adds `addthis_widget.js` onto
         * the site (if not added manually). The
         * `$addthisProvider.disableAutoAdd` method disables this
         * functionality. This method re-enables it.
         *
         * ```js
         * app.config(function($addthisProvider, $envProvider) {
         *     $addthisProvider.disableAutoAdd();
         *     if ($envProvider.isProduction()) {
         *         $addthisProvider.enableAutoAdd();
         *     }
         * });
         * ```
         *
         * @returns {addthisProvider object} Returns the $addthisProvider object
         **/
        this.enableAutoAdd = function() {
            autoAddScript = true;
            return this;
        };

        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#scriptInHead
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * By default, this module automatically adds `addthis_widget.js` onto
         * the site towards the bottom of the DOM (if not added manually). This
         * function will change that and append `addthis_widget.js` onto the
         * DOM's `<HEAD>` element
         *
         * ```js
         * app.config(function($addthisProvider, $envProvider) {
         *     $addthisProvider.scriptInHead();
         * });
         * ```
         *
         * @returns {addthisProvider object} Returns the $addthisProvider object
         **/
        this.scriptInHead = function() {
            scriptInFooter = false;
            return this;
        };

        /**
         * @ngdoc method
         * @name addthis.$addthisProvider#environment
         * @methodOf addthis.$addthisProvider
         *
         * @description
         * Changes the environment out of which the addthis_widget.js script is
         * included. Defaults to AddThis's production environment. Environments
         * test, dev and local are only available inside AddThis firewalls for
         * use by AddThis developers. The unittest environment is used during
         * unit testing. Any other value will set things up for production.
         *
         * ```js
         * app.config(function($addthisProvider, $envProvider) {
         *     $addthisProvider.environment('unittest');
         * });
         * ```
         *
         * @param {string} env The environment to use. Defaults to production.
         * @returns {string} Returns the url for addthis_widget.js
         **/
        this.environment = function(env) {
            if (env === 'dev' || env === 'test' || env === 'local') {
                baseUrl = 'http://cache-'+env+'.addthis.com/js/300/addthis_widget.js';
            } else if (env === 'unittest') {
                baseUrl = 'addthis_widget.js';
            } else {
                baseUrl = defaultUrl;
            }

            return baseUrl;
        };

        this.$get = addthisService;

        return this;
    };


    addthisProvider.$inject = ['$windowProvider'];

    /*
     * All these params must also show up in the same order when adding the
     * run to the Angular app
     **/
    var addthisRun = function($window, $rootScope, $addthis) {
        if (Object.keys(addthis_config).length === 0 &&
            typeof $window.addthis_config === 'object' &&
            Object.keys($window.addthis_config).length !== 0
        ) {
            // if the user didn't set any general configuration options through
            // the module and window.addthis_config looks right on page and has
            // something in it use it
            addthis_config = angular.copy($window.addthis_config);
            if (addthis_config.pubid) {
                profileId = addthis_config.pubid;
            }
        } else {
            // else use what we've build through the
            $window.addthis_config = angular.copy(addthis_config);
        }

        if (Object.keys(addthis_share).length === 0 &&
            typeof $window.addthis_share === 'object' &&
            Object.keys($window.addthis_share).length !== 0
        ) {
            // if the user didn't set any share configuration options through
            // the module and window.addthis_config looks right on page and has
            // something in it use it
            addthis_share = angular.copy($window.addthis_share);
        } else {
            $window.addthis_share = angular.copy(addthis_share);
        }

        $window.addthis_plugin_info = addthis_plugin_info;

        // if auto add hasn't been disabled, auto add
        if (autoAddScript) {
            addScript($window.document);
        }

        // watch for URL changes and do a SmartLayers refresh when they happen
        $rootScope.$on(
            '$locationChangeSuccess',
            function(event, next, current) {
                if (next !== current) {
                    $addthis.layersRefresh();
                }
            }
        );
    };

    addthisRun.$inject = ['$window', '$rootScope', '$addthis'];


    /**
     * All these params must also show up in the same order when adding the
     * directive to the Angular app
     **/
    var addthisDirective = function($addthis, $timeout) {
        /**
         * @ngdoc directive
         * @name addthis.addthisTool
         * @restrict AECM
         *
         * @element ANY
         * @description
         * Use this directive to add an inline AddThis tool onto your page
         *
         * @example
         * This example shows how you would add `addthis_sharing_toolbox` on
         * your page and share url http://www.example.com with the text
         * "Check this out:"
         *  ```html
         *  <example
         *     addthis-tool
         *     tool-class="'addthis_sharing_toolbox'"
         *     share-url="'http://www.example.com'"
         *     share-title="'Check this out:'"
         *     share-description="'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'"
         *     share-media="'http://www.example.com/img.png'"
         * >
         * </example>
         *  ```
         *
         * @param {string} toolClass the tool class/id for the AddThis inline
         *   tool you want to add onto the page.
         * @param {string} shareUrl (optional) the url to share when your
         *   visitor clicks on a share button in this tool.
         * @param {string} shareTitle (optional) the string shared with the url
         *   when your visitor clicks on a share button in this tool.
         *
         *   Note: Some services (such as Facebook) do not allow you to define
         *   the share title for a URL this way. Facebook will always use the
         *   Open Graph tags it finds on the page when it crawls it. You can use
         *   the <a href="https://developers.facebook.com/tools/debug/">
         *   Facebook Sharing Debugger</a> to test your Open Graph tags.
         * @param {string} shareDescription (optional) the description string
         *   shared with the url when your visitor clicks on a share button in
         *    this tool.
         *
         *   Note: Some services (such as Facebook) do not allow you to define
         *   the share description for a URL this way. Facebook will always use
         *   the Open Graph tags it finds on the page when it crawls it. You can
         *   use the <a href="https://developers.facebook.com/tools/debug/">
         *   Facebook Sharing Debugger</a> to test your Open Graph tags.
         * @param {string} shareMedia (optional) the URL for an image to share
         *   with the url when your visitor clicks on a share button in this
         *   tool.
         *
         *   Note: Some services (such as Facebook) do not allow you to define
         *   the share image for a URL this way. Facebook will always use the
         *   Open Graph tags it finds on the page when it crawls it. You can use
         *   the <a href="https://developers.facebook.com/tools/debug/">
         *   Facebook Sharing Debugger</a> to test your Open Graph tags.
         **/
        var directive = {
            restrict: 'AECM',
            scope: {
                toolClass: '=toolClass',
                shareUrl: '=shareUrl',
                shareTitle: '=shareTitle',
                shareDescription: '=shareDescription',
                shareMedia: '=shareMedia'
            },
            link: function($scope, el) {
                // attr documentation available at http://www.addthis.com/academy/setting-the-url-title-to-share/
                var urlAttr = 'data-url';
                var titleAttr = 'data-title';
                var descriptionAttr = 'data-description';
                var mediaAttr = 'data-media';

                /**
                 * @private
                 * @description
                 * Removes the content inside the directive, and appends a new
                 * DIV element with the tool's class, and (if defined) share-url,
                 * share-title, share-description and share-media. Why?
                 * `addthis_widget.js` won't touch/refresh elements for inline
                 * it thinks it has already rendered.
                 **/
                var recreateToolDiv = function() {
                    // build new div
                    var newToolDiv = document.createElement('div');
                    newToolDiv.className = $scope.toolClass;

                    // only include share URL attr if provided
                    if (angular.isDefined($scope.shareUrl)) {
                        newToolDiv.setAttribute(urlAttr, $scope.shareUrl);
                    }

                    // only include share title attr if provided
                    if (angular.isDefined($scope.shareTitle)) {
                        newToolDiv.setAttribute(titleAttr, $scope.shareTitle);
                    }

                    // only include share description attr if provided
                    if (angular.isDefined($scope.shareDescription)) {
                        newToolDiv.setAttribute(descriptionAttr, $scope.shareDescription);
                    }

                    // only include share media attr if provided
                    if (angular.isDefined($scope.shareMedia)) {
                        newToolDiv.setAttribute(mediaAttr, $scope.shareMedia);
                    }

                    // remove previous DIV, if present
                    el.empty();

                    // add new DIV
                    el.append(newToolDiv);

                    // call layersRefresh after Angular has finised rendering the DOM
                    $timeout(function() {
                        $addthis.layersRefresh();
                    });
                };
                // bootstrap the directive
                recreateToolDiv();

                // watch for changes in attrs and rerender the tool DIV when
                // they're meaningful
                $scope.$watchGroup(
                    ['toolClass', 'shareUrl', 'shareTitle', 'shareDescription', 'shareMedia'],
                    function(newVal, oldVal) {
                        if (newVal[0] !== oldVal[0] ||
                            newVal[1] !== oldVal[1] ||
                            newVal[2] !== oldVal[2] ||
                            newVal[3] !== oldVal[3] ||
                            newVal[4] !== oldVal[4]
                        ) {
                            recreateToolDiv();
                        }
                    }
                );
            }
        };

        return directive;
    };


    addthisDirective.$inject = ['$addthis', '$timeout'];


    /**
     * @name addthis
     * @ngdoc overview
     * @description
     * Free and Pro AddThis tools to your AngularJS app. This AngularJS module
     * includes a directive, service and provider. It is smart about route/location
     * changes and the AngularJS digest cycles and how they affect AddThis tools.
     * Requires a free AddThis account.
     **/
    var addthisModule = angular.module('addthis', ['ng']);

    /*
     * Except for the last array item, all these items must in the array must
     * show up in the same order the params in addthisProvider
     **/
    addthisModule.provider('$addthis', ['$windowProvider', addthisProvider]);

    /*
     * Except for the last array item, all these items must also show up in the
     * same order the params in addthisRun
     **/
    addthisModule.run([
        '$window',
        '$rootScope',
        '$addthis',
        addthisRun
    ]);

    /*
     * Except for the last array item, all these items must in the array must
     * show up in the same order the params in addthisDirective
     **/
    addthisModule.directive('addthisTool', [
        '$addthis',
        '$timeout',
        addthisDirective
    ]);
    return addthisModule;
}(window, angular));
