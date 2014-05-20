;(function(window, navigator, document, undefined) {
var utils, videoStream, worker, gifWriter, animatedGif, screenShot, error, index;
utils = function () {
    var utils = {
            'URL': window.URL || window.webkitURL || window.mozURL || window.msURL,
            'getUserMedia': function () {
                var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
                return getUserMedia ? getUserMedia.bind(navigator) : getUserMedia;
            }(),
            'Blob': window.Blob || window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder,
            'isObject': function (obj) {
                if (!obj) {
                    return false;
                }
                return Object.prototype.toString.call(obj) === '[object Object]';
            },
            'isArray': function (arr) {
                if (!arr) {
                    return false;
                }
                if ('isArray' in Array) {
                    return Array.isArray(arr);
                } else {
                    return Object.prototype.toString.call(arr) === '[object Array]';
                }
            },
            'isFunction': function (func) {
                if (!func) {
                    return false;
                }
                return Object.prototype.toString.call(func) === '[object Function]';
            },
            'isElement': function (elem) {
                return elem && elem.nodeType === 1;
            },
            'isString': function (value) {
                return typeof value === 'string' || Object.prototype.toString.call(value) === '[object String]';
            },
            'isSupported': {
                'canvas': function () {
                    var el = document.createElement('canvas');
                    return !!(el.getContext && el.getContext('2d'));
                },
                'console': function () {
                    var console = window.console;
                    return console && utils.isFunction(console.log);
                },
                'webworkers': function () {
                    var worker = window.Worker;
                    return utils.isFunction(worker);
                },
                'blob': function () {
                    return utils.Blob;
                }
            },
            'log': function () {
                if (utils.isSupported.console()) {
                    console.log.apply(window.console, arguments);
                }
            },
            'noop': function () {
            },
            'each': function (collection, callback) {
                var x, len;
                if (utils.isArray(collection)) {
                    x = -1;
                    len = collection.length;
                    while (++x < len) {
                        if (callback(x, collection[x]) === false) {
                            break;
                        }
                    }
                } else if (utils.isObject(collection)) {
                    for (x in collection) {
                        if (collection.hasOwnProperty(x)) {
                            if (callback(x, collection[x]) === false) {
                                break;
                            }
                        }
                    }
                }
            },
            'mergeOptions': function deepMerge(defaultOptions, userOptions) {
                if (!utils.isObject(defaultOptions) || !utils.isObject(userOptions) || !Object.keys) {
                    return;
                }
                var newObj = {};
                utils.each(defaultOptions, function (key, val) {
                    newObj[key] = defaultOptions[key];
                });
                utils.each(userOptions, function (key, val) {
                    var currentUserOption = userOptions[key];
                    if (!utils.isObject(currentUserOption)) {
                        newObj[key] = currentUserOption;
                    } else {
                        if (!defaultOptions[key]) {
                            newObj[key] = currentUserOption;
                        } else {
                            newObj[key] = deepMerge(defaultOptions[key], currentUserOption);
                        }
                    }
                });
                return newObj;
            },
            'setCSSAttr': function (elem, attr, val) {
                if (!utils.isElement(elem)) {
                    return;
                }
                if (utils.isString(attr) && utils.isString(val)) {
                    elem.style[attr] = val;
                } else if (utils.isObject(attr)) {
                    utils.each(attr, function (key, val) {
                        elem.style[key] = val;
                    });
                }
            },
            'removeElement': function (node) {
                if (!utils.isElement(node)) {
                    return;
                }
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            },
            'set': function (name, value) {
                if (utils.isSupported.localStorage()) {
                    window.localStorage.setItem(name, value);
                }
            },
            'get': function (name) {
                if (utils.isSupported.localStorage()) {
                    window.localStorage.getItem(name);
                }
            },
            'createWebWorker': function (content) {
                if (!utils.isString(content)) {
                    return {};
                }
                try {
                    var blob = new utils.Blob([content], { 'type': 'text/javascript' }), objectUrl = window.URL.createObjectURL(blob), worker = new Worker(objectUrl);
                    return {
                        'objectUrl': objectUrl,
                        'worker': worker
                    };
                } catch (e) {
                    return {};
                }
            }
        };
    return utils;
}();
videoStream = function () {
    return {
        'defaultVideoDimensions': {
            'height': 200,
            'width': 200
        },
        'loadedData': false,
        'findVideoSize': function findVideoSize(obj) {
            var videoElement = obj.videoElement, cameraStream = obj.cameraStream, completedCallback = obj.completedCallback;
            if (!videoElement) {
                return;
            }
            if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                videoElement.removeEventListener('loadeddata', this.findVideoSize);
                completedCallback({
                    'videoElement': videoElement,
                    'cameraStream': cameraStream,
                    'videoWidth': videoElement.videoWidth,
                    'videoHeight': videoElement.videoHeight
                });
            } else {
                if (findVideoSize.attempts < 10) {
                    findVideoSize.attempts += 1;
                    setTimeout(findVideoSize, 200);
                } else {
                    completedCallback({
                        'videoElement': videoElement,
                        'cameraStream': cameraStream,
                        'videoWidth': this.defaultVideoDimensions.width,
                        'videoHeight': this.defaultVideoDimensions.height
                    });
                }
            }
        },
        'onStreamingTimeout': function (callback) {
            if (utils.isFunction(callback)) {
                callback({
                    'error': true,
                    'errorCode': 'getUserMedia',
                    'errorMsg': 'There was an issue with the getUserMedia API - Timed out while trying to start streaming',
                    'image': null,
                    'cameraStream': {}
                });
            }
        },
        'stream': function (obj) {
            var self = this, videoElement = obj.videoElement, cameraStream = obj.cameraStream, streamedCallback = obj.streamedCallback, completedCallback = obj.completedCallback;
            streamedCallback();
            if (videoElement.mozSrcObject) {
                videoElement.mozSrcObject = cameraStream;
            } else if (utils.URL) {
                videoElement.src = utils.URL.createObjectURL(cameraStream);
            }
            videoElement.play();
            setTimeout(function checkLoadedData() {
                checkLoadedData.count = checkLoadedData.count || 0;
                if (self.loadedData === true) {
                    self.findVideoSize({
                        'videoElement': videoElement,
                        'cameraStream': cameraStream,
                        'completedCallback': completedCallback
                    });
                    self.loadedData = false;
                } else {
                    checkLoadedData.count += 1;
                    if (checkLoadedData.count > 10) {
                        self.findVideoSize({
                            'videoElement': videoElement,
                            'cameraStream': cameraStream,
                            'completedCallback': completedCallback
                        });
                    } else {
                        checkLoadedData();
                    }
                }
            }, 100);
        },
        'startStreaming': function (obj) {
            var self = this, errorCallback = utils.isFunction(obj.error) ? obj.error : utils.noop, streamedCallback = utils.isFunction(obj.streamed) ? obj.streamed : utils.noop, completedCallback = utils.isFunction(obj.completed) ? obj.completed : utils.noop, videoElement = document.createElement('video'), lastCameraStream = obj.lastCameraStream, cameraStream;
            videoElement.autoplay = true;
            videoElement.addEventListener('loadeddata', function (event) {
                self.loadedData = true;
            });
            if (lastCameraStream) {
                self.stream({
                    'videoElement': videoElement,
                    'cameraStream': lastCameraStream,
                    'streamedCallback': streamedCallback,
                    'completedCallback': completedCallback
                });
            } else {
                utils.getUserMedia({ 'video': true }, function (stream) {
                    self.stream({
                        'videoElement': videoElement,
                        'cameraStream': stream,
                        'streamedCallback': streamedCallback,
                        'completedCallback': completedCallback
                    });
                }, errorCallback);
            }
        },
        startVideoStreaming: function (callback, options) {
            options = options || {};
            var self = this, noGetUserMediaSupportTimeout, timeoutLength = options.timeout !== undefined ? options.timeout : 0, originalCallback = options.callback;
            // Some browsers apparently have support for video streaming because of the
            // presence of the getUserMedia function, but then do not answer our
            // calls for streaming.
            // So we'll set up this timeout and if nothing happens after a while, we'll
            // conclude that there's no actual getUserMedia support.
            if (timeoutLength > 0) {
                noGetUserMediaSupportTimeout = setTimeout(function () {
                    self.onStreamingTimeout(originalCallback);
                }, 10000);
            }
            this.startStreaming({
                'error': function () {
                    originalCallback({
                        'error': true,
                        'errorCode': 'getUserMedia',
                        'errorMsg': 'There was an issue with the getUserMedia API - the user probably denied permission',
                        'image': null,
                        'cameraStream': {}
                    });
                },
                'streamed': function () {
                    // The streaming started somehow, so we can assume there is getUserMedia support
                    clearTimeout(noGetUserMediaSupportTimeout);
                },
                'completed': function (obj) {
                    var cameraStream = this.cameraStream = obj.cameraStream, videoElement = this.videoElement = obj.videoElement, videoWidth = obj.videoWidth, videoHeight = obj.videoHeight;
                    callback({
                        'cameraStream': cameraStream,
                        'videoElement': videoElement,
                        'videoWidth': videoWidth,
                        'videoHeight': videoHeight
                    });
                },
                'lastCameraStream': options.lastCameraStream
            });
        },
        'stopVideoStreaming': function (obj) {
            obj = utils.isObject(obj) ? obj : {};
            var cameraStream = obj.cameraStream, videoElement = obj.videoElement, keepCameraOn = obj.keepCameraOn;
            if (!keepCameraOn && cameraStream && utils.isFunction(cameraStream.stop)) {
                // Stops the camera stream
                cameraStream.stop();
            }
            if (utils.isElement(videoElement)) {
                // Pauses the video, revokes the object URL (freeing up memory), and remove the video element
                videoElement.pause();
                // Destroys the object url
                if (utils.isFunction(utils.URL.revokeObjectURL)) {
                    utils.URL.revokeObjectURL(videoElement.src);
                }
                // Removes the video element from the DOM
                utils.removeElement(videoElement);
            }
        }
    };
}();
worker = function () {
    var workerCode = function worker() {
            function dataToRGB(data, width, height) {
                var i = 0;
                var length = width * height * 4;
                var rgb = [];
                while (i < length) {
                    rgb.push(data[i++]);
                    rgb.push(data[i++]);
                    rgb.push(data[i++]);
                    i++;
                }
                return rgb;
            }
            function componentizedPaletteToArray(paletteRGB) {
                var paletteArray = [];
                for (var i = 0; i < paletteRGB.length; i += 3) {
                    var r = paletteRGB[i];
                    var g = paletteRGB[i + 1];
                    var b = paletteRGB[i + 2];
                    paletteArray.push(r << 16 | g << 8 | b);
                }
                return paletteArray;
            }
            // This is the "traditional" Animated_GIF style of going from RGBA to indexed color frames
            function processFrameWithQuantizer(imageData, width, height, sampleInterval) {
                var rgbComponents = dataToRGB(imageData, width, height);
                var nq = new NeuQuant(rgbComponents, rgbComponents.length, sampleInterval);
                var paletteRGB = nq.process();
                var paletteArray = new Uint32Array(componentizedPaletteToArray(paletteRGB));
                var numberPixels = width * height;
                var indexedPixels = new Uint8Array(numberPixels);
                var k = 0;
                for (var i = 0; i < numberPixels; i++) {
                    r = rgbComponents[k++];
                    g = rgbComponents[k++];
                    b = rgbComponents[k++];
                    indexedPixels[i] = nq.map(r, g, b);
                }
                return {
                    pixels: indexedPixels,
                    palette: paletteArray
                };
            }
            function run(frame) {
                var width = frame.width, height = frame.height, imageData = frame.data, palette = frame.palette, sampleInterval = frame.sampleInterval;
                return processFrameWithQuantizer(imageData, width, height, sampleInterval);
            }
            self.onmessage = function (ev) {
                var data = ev.data, response = run(data);
                postMessage(response);
            };
            /*
            * NeuQuant Neural-Net Quantization Algorithm
            * ------------------------------------------
            * 
            * Copyright (c) 1994 Anthony Dekker
            * 
            * NEUQUANT Neural-Net quantization algorithm by Anthony Dekker, 1994. See
            * "Kohonen neural networks for optimal colour quantization" in "Network:
            * Computation in Neural Systems" Vol. 5 (1994) pp 351-367. for a discussion of
            * the algorithm.
            * 
            * Any party obtaining a copy of these files from the author, directly or
            * indirectly, is granted, free of charge, a full and unrestricted irrevocable,
            * world-wide, paid up, royalty-free, nonexclusive right and license to deal in
            * this software and documentation files (the "Software"), including without
            * limitation the rights to use, copy, modify, merge, publish, distribute,
            * sublicense, and/or sell copies of the Software, and to permit persons who
            * receive copies from any such party to do so, with the only requirement being
            * that this copyright notice remain intact.
            */
            /*
            * This class handles Neural-Net quantization algorithm
            * @author Kevin Weiner (original Java version - kweiner@fmsware.com)
            * @author Thibault Imbert (AS3 version - bytearray.org)
            * @version 0.1 AS3 implementation
            * @version 0.2 JS->AS3 "translation" by antimatter15
            * @version 0.3 JS clean up + using modern JS idioms by sole - http://soledadpenades.com
            * Also implement fix in color conversion described at http://stackoverflow.com/questions/16371712/neuquant-js-javascript-color-quantization-hidden-bug-in-js-conversion
            */
            function NeuQuant() {
                var netsize = 256;
                // number of colours used
                // four primes near 500 - assume no image has a length so large
                // that it is divisible by all four primes
                var prime1 = 499;
                var prime2 = 491;
                var prime3 = 487;
                var prime4 = 503;
                // minimum size for input image
                var minpicturebytes = 3 * prime4;
                // Network Definitions
                var maxnetpos = netsize - 1;
                var netbiasshift = 4;
                // bias for colour values
                var ncycles = 100;
                // no. of learning cycles
                // defs for freq and bias
                var intbiasshift = 16;
                // bias for fractions
                var intbias = 1 << intbiasshift;
                var gammashift = 10;
                // gamma = 1024
                var gamma = 1 << gammashift;
                var betashift = 10;
                var beta = intbias >> betashift;
                // beta = 1/1024
                var betagamma = intbias << gammashift - betashift;
                // defs for decreasing radius factor
                // For 256 colors, radius starts at 32.0 biased by 6 bits
                // and decreases by a factor of 1/30 each cycle
                var initrad = netsize >> 3;
                var radiusbiasshift = 6;
                var radiusbias = 1 << radiusbiasshift;
                var initradius = initrad * radiusbias;
                var radiusdec = 30;
                // defs for decreasing alpha factor
                // Alpha starts at 1.0 biased by 10 bits
                var alphabiasshift = 10;
                var initalpha = 1 << alphabiasshift;
                var alphadec;
                // radbias and alpharadbias used for radpower calculation
                var radbiasshift = 8;
                var radbias = 1 << radbiasshift;
                var alpharadbshift = alphabiasshift + radbiasshift;
                var alpharadbias = 1 << alpharadbshift;
                // Input image
                var thepicture;
                // Height * Width * 3
                var lengthcount;
                // Sampling factor 1..30
                var samplefac;
                // The network itself
                var network;
                var netindex = [];
                // for network lookup - really 256
                var bias = [];
                // bias and freq arrays for learning
                var freq = [];
                var radpower = [];
                function NeuQuantConstructor(thepic, len, sample) {
                    var i;
                    var p;
                    thepicture = thepic;
                    lengthcount = len;
                    samplefac = sample;
                    network = new Array(netsize);
                    for (i = 0; i < netsize; i++) {
                        network[i] = new Array(4);
                        p = network[i];
                        p[0] = p[1] = p[2] = (i << netbiasshift + 8) / netsize | 0;
                        freq[i] = intbias / netsize | 0;
                        // 1 / netsize
                        bias[i] = 0;
                    }
                }
                function colorMap() {
                    var map = [];
                    var index = new Array(netsize);
                    for (var i = 0; i < netsize; i++)
                        index[network[i][3]] = i;
                    var k = 0;
                    for (var l = 0; l < netsize; l++) {
                        var j = index[l];
                        map[k++] = network[j][0];
                        map[k++] = network[j][1];
                        map[k++] = network[j][2];
                    }
                    return map;
                }
                // Insertion sort of network and building of netindex[0..255]
                // (to do after unbias)
                function inxbuild() {
                    var i;
                    var j;
                    var smallpos;
                    var smallval;
                    var p;
                    var q;
                    var previouscol;
                    var startpos;
                    previouscol = 0;
                    startpos = 0;
                    for (i = 0; i < netsize; i++) {
                        p = network[i];
                        smallpos = i;
                        smallval = p[1];
                        // index on g
                        // find smallest in i..netsize-1
                        for (j = i + 1; j < netsize; j++) {
                            q = network[j];
                            if (q[1] < smallval) {
                                // index on g
                                smallpos = j;
                                smallval = q[1];
                            }
                        }
                        q = network[smallpos];
                        // swap p (i) and q (smallpos) entries
                        if (i != smallpos) {
                            j = q[0];
                            q[0] = p[0];
                            p[0] = j;
                            j = q[1];
                            q[1] = p[1];
                            p[1] = j;
                            j = q[2];
                            q[2] = p[2];
                            p[2] = j;
                            j = q[3];
                            q[3] = p[3];
                            p[3] = j;
                        }
                        // smallval entry is now in position i
                        if (smallval != previouscol) {
                            netindex[previouscol] = startpos + i >> 1;
                            for (j = previouscol + 1; j < smallval; j++) {
                                netindex[j] = i;
                            }
                            previouscol = smallval;
                            startpos = i;
                        }
                    }
                    netindex[previouscol] = startpos + maxnetpos >> 1;
                    for (j = previouscol + 1; j < 256; j++) {
                        netindex[j] = maxnetpos;
                    }
                }
                // Main Learning Loop
                function learn() {
                    var i;
                    var j;
                    var b;
                    var g;
                    var r;
                    var radius;
                    var rad;
                    var alpha;
                    var step;
                    var delta;
                    var samplepixels;
                    var p;
                    var pix;
                    var lim;
                    if (lengthcount < minpicturebytes) {
                        samplefac = 1;
                    }
                    alphadec = 30 + (samplefac - 1) / 3;
                    p = thepicture;
                    pix = 0;
                    lim = lengthcount;
                    samplepixels = lengthcount / (3 * samplefac);
                    delta = samplepixels / ncycles | 0;
                    alpha = initalpha;
                    radius = initradius;
                    rad = radius >> radiusbiasshift;
                    if (rad <= 1) {
                        rad = 0;
                    }
                    for (i = 0; i < rad; i++) {
                        radpower[i] = alpha * ((rad * rad - i * i) * radbias / (rad * rad));
                    }
                    if (lengthcount < minpicturebytes) {
                        step = 3;
                    } else if (lengthcount % prime1 !== 0) {
                        step = 3 * prime1;
                    } else {
                        if (lengthcount % prime2 !== 0) {
                            step = 3 * prime2;
                        } else {
                            if (lengthcount % prime3 !== 0) {
                                step = 3 * prime3;
                            } else {
                                step = 3 * prime4;
                            }
                        }
                    }
                    i = 0;
                    while (i < samplepixels) {
                        b = (p[pix + 0] & 255) << netbiasshift;
                        g = (p[pix + 1] & 255) << netbiasshift;
                        r = (p[pix + 2] & 255) << netbiasshift;
                        j = contest(b, g, r);
                        altersingle(alpha, j, b, g, r);
                        if (rad !== 0) {
                            // Alter neighbours
                            alterneigh(rad, j, b, g, r);
                        }
                        pix += step;
                        if (pix >= lim) {
                            pix -= lengthcount;
                        }
                        i++;
                        if (delta === 0) {
                            delta = 1;
                        }
                        if (i % delta === 0) {
                            alpha -= alpha / alphadec;
                            radius -= radius / radiusdec;
                            rad = radius >> radiusbiasshift;
                            if (rad <= 1) {
                                rad = 0;
                            }
                            for (j = 0; j < rad; j++) {
                                radpower[j] = alpha * ((rad * rad - j * j) * radbias / (rad * rad));
                            }
                        }
                    }
                }
                // Search for BGR values 0..255 (after net is unbiased) and return colour index
                function map(b, g, r) {
                    var i;
                    var j;
                    var dist;
                    var a;
                    var bestd;
                    var p;
                    var best;
                    // Biggest possible distance is 256 * 3
                    bestd = 1000;
                    best = -1;
                    i = netindex[g];
                    // index on g
                    j = i - 1;
                    // start at netindex[g] and work outwards
                    while (i < netsize || j >= 0) {
                        if (i < netsize) {
                            p = network[i];
                            dist = p[1] - g;
                            // inx key
                            if (dist >= bestd) {
                                i = netsize;
                            } else {
                                i++;
                                if (dist < 0) {
                                    dist = -dist;
                                }
                                a = p[0] - b;
                                if (a < 0) {
                                    a = -a;
                                }
                                dist += a;
                                if (dist < bestd) {
                                    a = p[2] - r;
                                    if (a < 0) {
                                        a = -a;
                                    }
                                    dist += a;
                                    if (dist < bestd) {
                                        bestd = dist;
                                        best = p[3];
                                    }
                                }
                            }
                        }
                        if (j >= 0) {
                            p = network[j];
                            dist = g - p[1];
                            // inx key - reverse dif
                            if (dist >= bestd) {
                                j = -1;
                            } else {
                                j--;
                                if (dist < 0) {
                                    dist = -dist;
                                }
                                a = p[0] - b;
                                if (a < 0) {
                                    a = -a;
                                }
                                dist += a;
                                if (dist < bestd) {
                                    a = p[2] - r;
                                    if (a < 0) {
                                        a = -a;
                                    }
                                    dist += a;
                                    if (dist < bestd) {
                                        bestd = dist;
                                        best = p[3];
                                    }
                                }
                            }
                        }
                    }
                    return best;
                }
                function process() {
                    learn();
                    unbiasnet();
                    inxbuild();
                    return colorMap();
                }
                // Unbias network to give byte values 0..255 and record position i
                // to prepare for sort
                function unbiasnet() {
                    var i;
                    var j;
                    for (i = 0; i < netsize; i++) {
                        network[i][0] >>= netbiasshift;
                        network[i][1] >>= netbiasshift;
                        network[i][2] >>= netbiasshift;
                        network[i][3] = i;
                    }
                }
                // Move adjacent neurons by precomputed alpha*(1-((i-j)^2/[r]^2))
                // in radpower[|i-j|]
                function alterneigh(rad, i, b, g, r) {
                    var j;
                    var k;
                    var lo;
                    var hi;
                    var a;
                    var m;
                    var p;
                    lo = i - rad;
                    if (lo < -1) {
                        lo = -1;
                    }
                    hi = i + rad;
                    if (hi > netsize) {
                        hi = netsize;
                    }
                    j = i + 1;
                    k = i - 1;
                    m = 1;
                    while (j < hi || k > lo) {
                        a = radpower[m++];
                        if (j < hi) {
                            p = network[j++];
                            try {
                                p[0] -= a * (p[0] - b) / alpharadbias | 0;
                                p[1] -= a * (p[1] - g) / alpharadbias | 0;
                                p[2] -= a * (p[2] - r) / alpharadbias | 0;
                            } catch (e) {
                            }
                        }
                        if (k > lo) {
                            p = network[k--];
                            try {
                                p[0] -= a * (p[0] - b) / alpharadbias | 0;
                                p[1] -= a * (p[1] - g) / alpharadbias | 0;
                                p[2] -= a * (p[2] - r) / alpharadbias | 0;
                            } catch (e) {
                            }
                        }
                    }
                }
                // Move neuron i towards biased (b,g,r) by factor alpha
                function altersingle(alpha, i, b, g, r) {
                    // alter hit neuron
                    var n = network[i];
                    var alphaMult = alpha / initalpha;
                    n[0] -= alphaMult * (n[0] - b) | 0;
                    n[1] -= alphaMult * (n[1] - g) | 0;
                    n[2] -= alphaMult * (n[2] - r) | 0;
                }
                // Search for biased BGR values
                function contest(b, g, r) {
                    // finds closest neuron (min dist) and updates freq
                    // finds best neuron (min dist-bias) and returns position
                    // for frequently chosen neurons, freq[i] is high and bias[i] is negative
                    // bias[i] = gamma*((1/netsize)-freq[i])
                    var i;
                    var dist;
                    var a;
                    var biasdist;
                    var betafreq;
                    var bestpos;
                    var bestbiaspos;
                    var bestd;
                    var bestbiasd;
                    var n;
                    bestd = ~(1 << 31);
                    bestbiasd = bestd;
                    bestpos = -1;
                    bestbiaspos = bestpos;
                    for (i = 0; i < netsize; i++) {
                        n = network[i];
                        dist = n[0] - b;
                        if (dist < 0) {
                            dist = -dist;
                        }
                        a = n[1] - g;
                        if (a < 0) {
                            a = -a;
                        }
                        dist += a;
                        a = n[2] - r;
                        if (a < 0) {
                            a = -a;
                        }
                        dist += a;
                        if (dist < bestd) {
                            bestd = dist;
                            bestpos = i;
                        }
                        biasdist = dist - (bias[i] >> intbiasshift - netbiasshift);
                        if (biasdist < bestbiasd) {
                            bestbiasd = biasdist;
                            bestbiaspos = i;
                        }
                        betafreq = freq[i] >> betashift;
                        freq[i] -= betafreq;
                        bias[i] += betafreq << gammashift;
                    }
                    freq[bestpos] += beta;
                    bias[bestpos] -= betagamma;
                    return bestbiaspos;
                }
                NeuQuantConstructor.apply(this, arguments);
                var exports = {};
                exports.map = map;
                exports.process = process;
                return exports;
            }
        }, workerCodeString = workerCode.toString() + 'worker();';
    return workerCodeString;
}();
gifWriter = function () {
    function GifWriter(buf, width, height, gopts) {
        var p = 0;
        gopts = gopts === undefined ? {} : gopts;
        var loop_count = gopts.loop === undefined ? null : gopts.loop;
        var global_palette = gopts.palette === undefined ? null : gopts.palette;
        if (width <= 0 || height <= 0 || width > 65535 || height > 65535)
            throw 'Width/Height invalid.';
        function check_palette_and_num_colors(palette) {
            var num_colors = palette.length;
            if (num_colors < 2 || num_colors > 256 || num_colors & num_colors - 1)
                throw 'Invalid code/color length, must be power of 2 and 2 .. 256.';
            return num_colors;
        }
        // - Header.
        buf[p++] = 71;
        buf[p++] = 73;
        buf[p++] = 70;
        // GIF
        buf[p++] = 56;
        buf[p++] = 57;
        buf[p++] = 97;
        // 89a
        // Handling of Global Color Table (palette) and background index.
        var gp_num_colors_pow2 = 0;
        var background = 0;
        if (global_palette !== null) {
            var gp_num_colors = check_palette_and_num_colors(global_palette);
            while (gp_num_colors >>= 1)
                ++gp_num_colors_pow2;
            gp_num_colors = 1 << gp_num_colors_pow2;
            --gp_num_colors_pow2;
            if (gopts.background !== undefined) {
                background = gopts.background;
                if (background >= gp_num_colors)
                    throw 'Background index out of range.';
                // The GIF spec states that a background index of 0 should be ignored, so
                // this is probably a mistake and you really want to set it to another
                // slot in the palette.  But actually in the end most browsers, etc end
                // up ignoring this almost completely (including for dispose background).
                if (background === 0)
                    throw 'Background index explicitly passed as 0.';
            }
        }
        // - Logical Screen Descriptor.
        // NOTE(deanm): w/h apparently ignored by implementations, but set anyway.
        buf[p++] = width & 255;
        buf[p++] = width >> 8 & 255;
        buf[p++] = height & 255;
        buf[p++] = height >> 8 & 255;
        // NOTE: Indicates 0-bpp original color resolution (unused?).
        buf[p++] = (global_palette !== null ? 128 : 0) | // Global Color Table Flag.
        gp_num_colors_pow2;
        // NOTE: No sort flag (unused?).
        buf[p++] = background;
        // Background Color Index.
        buf[p++] = 0;
        // Pixel aspect ratio (unused?).
        // - Global Color Table
        if (global_palette !== null) {
            for (var i = 0, il = global_palette.length; i < il; ++i) {
                var rgb = global_palette[i];
                buf[p++] = rgb >> 16 & 255;
                buf[p++] = rgb >> 8 & 255;
                buf[p++] = rgb & 255;
            }
        }
        if (loop_count !== null) {
            // Netscape block for looping.
            if (loop_count < 0 || loop_count > 65535)
                throw 'Loop count invalid.';
            // Extension code, label, and length.
            buf[p++] = 33;
            buf[p++] = 255;
            buf[p++] = 11;
            // NETSCAPE2.0
            buf[p++] = 78;
            buf[p++] = 69;
            buf[p++] = 84;
            buf[p++] = 83;
            buf[p++] = 67;
            buf[p++] = 65;
            buf[p++] = 80;
            buf[p++] = 69;
            buf[p++] = 50;
            buf[p++] = 46;
            buf[p++] = 48;
            // Sub-block
            buf[p++] = 3;
            buf[p++] = 1;
            buf[p++] = loop_count & 255;
            buf[p++] = loop_count >> 8 & 255;
            buf[p++] = 0;
        }
        var ended = false;
        this.addFrame = function (x, y, w, h, indexed_pixels, opts) {
            if (ended === true) {
                --p;
                ended = false;
            }
            // Un-end.
            opts = opts === undefined ? {} : opts;
            // TODO(deanm): Bounds check x, y.  Do they need to be within the virtual
            // canvas width/height, I imagine?
            if (x < 0 || y < 0 || x > 65535 || y > 65535)
                throw 'x/y invalid.';
            if (w <= 0 || h <= 0 || w > 65535 || h > 65535)
                throw 'Width/Height invalid.';
            if (indexed_pixels.length < w * h)
                throw 'Not enough pixels for the frame size.';
            var using_local_palette = true;
            var palette = opts.palette;
            if (palette === undefined || palette === null) {
                using_local_palette = false;
                palette = global_palette;
            }
            if (palette === undefined || palette === null)
                throw 'Must supply either a local or global palette.';
            var num_colors = check_palette_and_num_colors(palette);
            // Compute the min_code_size (power of 2), destroying num_colors.
            var min_code_size = 0;
            while (num_colors >>= 1)
                ++min_code_size;
            num_colors = 1 << min_code_size;
            // Now we can easily get it back.
            var delay = opts.delay === undefined ? 0 : opts.delay;
            // From the spec:
            //     0 -   No disposal specified. The decoder is
            //           not required to take any action.
            //     1 -   Do not dispose. The graphic is to be left
            //           in place.
            //     2 -   Restore to background color. The area used by the
            //           graphic must be restored to the background color.
            //     3 -   Restore to previous. The decoder is required to
            //           restore the area overwritten by the graphic with
            //           what was there prior to rendering the graphic.
            //  4-7 -    To be defined.
            // NOTE(deanm): Dispose background doesn't really work, apparently most
            // browsers ignore the background palette index and clear to transparency.
            var disposal = opts.disposal === undefined ? 0 : opts.disposal;
            if (disposal < 0 || disposal > 3)
                // 4-7 is reserved.
                throw 'Disposal out of range.';
            var use_transparency = false;
            var transparent_index = 0;
            if (opts.transparent !== undefined && opts.transparent !== null) {
                use_transparency = true;
                transparent_index = opts.transparent;
                if (transparent_index < 0 || transparent_index >= num_colors)
                    throw 'Transparent color index.';
            }
            if (disposal !== 0 || use_transparency || delay !== 0) {
                // - Graphics Control Extension
                buf[p++] = 33;
                buf[p++] = 249;
                // Extension / Label.
                buf[p++] = 4;
                // Byte size.
                buf[p++] = disposal << 2 | (use_transparency === true ? 1 : 0);
                buf[p++] = delay & 255;
                buf[p++] = delay >> 8 & 255;
                buf[p++] = transparent_index;
                // Transparent color index.
                buf[p++] = 0;
            }
            // - Image Descriptor
            buf[p++] = 44;
            // Image Seperator.
            buf[p++] = x & 255;
            buf[p++] = x >> 8 & 255;
            // Left.
            buf[p++] = y & 255;
            buf[p++] = y >> 8 & 255;
            // Top.
            buf[p++] = w & 255;
            buf[p++] = w >> 8 & 255;
            buf[p++] = h & 255;
            buf[p++] = h >> 8 & 255;
            // NOTE: No sort flag (unused?).
            // TODO(deanm): Support interlace.
            buf[p++] = using_local_palette === true ? 128 | min_code_size - 1 : 0;
            // - Local Color Table
            if (using_local_palette === true) {
                for (var i = 0, il = palette.length; i < il; ++i) {
                    var rgb = palette[i];
                    buf[p++] = rgb >> 16 & 255;
                    buf[p++] = rgb >> 8 & 255;
                    buf[p++] = rgb & 255;
                }
            }
            p = GifWriterOutputLZWCodeStream(buf, p, min_code_size < 2 ? 2 : min_code_size, indexed_pixels);
        };
        this.end = function () {
            if (ended === false) {
                buf[p++] = 59;
                // Trailer.
                ended = true;
            }
            return p;
        };
    }
    // Main compression routine, palette indexes -> LZW code stream.
    // |index_stream| must have at least one entry.
    function GifWriterOutputLZWCodeStream(buf, p, min_code_size, index_stream) {
        buf[p++] = min_code_size;
        var cur_subblock = p++;
        // Pointing at the length field.
        var clear_code = 1 << min_code_size;
        var code_mask = clear_code - 1;
        var eoi_code = clear_code + 1;
        var next_code = eoi_code + 1;
        var cur_code_size = min_code_size + 1;
        // Number of bits per code.
        var cur_shift = 0;
        // We have at most 12-bit codes, so we should have to hold a max of 19
        // bits here (and then we would write out).
        var cur = 0;
        function emit_bytes_to_buffer(bit_block_size) {
            while (cur_shift >= bit_block_size) {
                buf[p++] = cur & 255;
                cur >>= 8;
                cur_shift -= 8;
                if (p === cur_subblock + 256) {
                    // Finished a subblock.
                    buf[cur_subblock] = 255;
                    cur_subblock = p++;
                }
            }
        }
        function emit_code(c) {
            cur |= c << cur_shift;
            cur_shift += cur_code_size;
            emit_bytes_to_buffer(8);
        }
        // I am not an expert on the topic, and I don't want to write a thesis.
        // However, it is good to outline here the basic algorithm and the few data
        // structures and optimizations here that make this implementation fast.
        // The basic idea behind LZW is to build a table of previously seen runs
        // addressed by a short id (herein called output code).  All data is
        // referenced by a code, which represents one or more values from the
        // original input stream.  All input bytes can be referenced as the same
        // value as an output code.  So if you didn't want any compression, you
        // could more or less just output the original bytes as codes (there are
        // some details to this, but it is the idea).  In order to achieve
        // compression, values greater then the input range (codes can be up to
        // 12-bit while input only 8-bit) represent a sequence of previously seen
        // inputs.  The decompressor is able to build the same mapping while
        // decoding, so there is always a shared common knowledge between the
        // encoding and decoder, which is also important for "timing" aspects like
        // how to handle variable bit width code encoding.
        //
        // One obvious but very important consequence of the table system is there
        // is always a unique id (at most 12-bits) to map the runs.  'A' might be
        // 4, then 'AA' might be 10, 'AAA' 11, 'AAAA' 12, etc.  This relationship
        // can be used for an effecient lookup strategy for the code mapping.  We
        // need to know if a run has been seen before, and be able to map that run
        // to the output code.  Since we start with known unique ids (input bytes),
        // and then from those build more unique ids (table entries), we can
        // continue this chain (almost like a linked list) to always have small
        // integer values that represent the current byte chains in the encoder.
        // This means instead of tracking the input bytes (AAAABCD) to know our
        // current state, we can track the table entry for AAAABC (it is guaranteed
        // to exist by the nature of the algorithm) and the next character D.
        // Therefor the tuple of (table_entry, byte) is guaranteed to also be
        // unique.  This allows us to create a simple lookup key for mapping input
        // sequences to codes (table indices) without having to store or search
        // any of the code sequences.  So if 'AAAA' has a table entry of 12, the
        // tuple of ('AAAA', K) for any input byte K will be unique, and can be our
        // key.  This leads to a integer value at most 20-bits, which can always
        // fit in an SMI value and be used as a fast sparse array / object key.
        // Output code for the current contents of the index buffer.
        var ib_code = index_stream[0] & code_mask;
        // Load first input index.
        var code_table = {};
        // Key'd on our 20-bit "tuple".
        emit_code(clear_code);
        // Spec says first code should be a clear code.
        // First index already loaded, process the rest of the stream.
        for (var i = 1, il = index_stream.length; i < il; ++i) {
            var k = index_stream[i] & code_mask;
            var cur_key = ib_code << 8 | k;
            // (prev, k) unique tuple.
            var cur_code = code_table[cur_key];
            // buffer + k.
            // Check if we have to create a new code table entry.
            if (cur_code === undefined) {
                // We don't have buffer + k.
                // Emit index buffer (without k).
                // This is an inline version of emit_code, because this is the core
                // writing routine of the compressor (and V8 cannot inline emit_code
                // because it is a closure here in a different context).  Additionally
                // we can call emit_byte_to_buffer less often, because we can have
                // 30-bits (from our 31-bit signed SMI), and we know our codes will only
                // be 12-bits, so can safely have 18-bits there without overflow.
                // emit_code(ib_code);
                cur |= ib_code << cur_shift;
                cur_shift += cur_code_size;
                while (cur_shift >= 8) {
                    buf[p++] = cur & 255;
                    cur >>= 8;
                    cur_shift -= 8;
                    if (p === cur_subblock + 256) {
                        // Finished a subblock.
                        buf[cur_subblock] = 255;
                        cur_subblock = p++;
                    }
                }
                if (next_code === 4096) {
                    // Table full, need a clear.
                    emit_code(clear_code);
                    next_code = eoi_code + 1;
                    cur_code_size = min_code_size + 1;
                    code_table = {};
                } else {
                    // Table not full, insert a new entry.
                    // Increase our variable bit code sizes if necessary.  This is a bit
                    // tricky as it is based on "timing" between the encoding and
                    // decoder.  From the encoders perspective this should happen after
                    // we've already emitted the index buffer and are about to create the
                    // first table entry that would overflow our current code bit size.
                    if (next_code >= 1 << cur_code_size)
                        ++cur_code_size;
                    code_table[cur_key] = next_code++;
                }
                ib_code = k;
            } else {
                ib_code = cur_code;
            }
        }
        emit_code(ib_code);
        // There will still be something in the index buffer.
        emit_code(eoi_code);
        // End Of Information.
        // Flush / finalize the sub-blocks stream to the buffer.
        emit_bytes_to_buffer(1);
        // Finish the sub-blocks, writing out any unfinished lengths and
        // terminating with a sub-block of length 0.  If we have already started
        // but not yet used a sub-block it can just become the terminator.
        if (cur_subblock + 1 === p) {
            // Started but unused.
            buf[cur_subblock] = 0;
        } else {
            // Started and used, write length and additional terminator block.
            buf[cur_subblock] = p - cur_subblock - 1;
            buf[p++] = 0;
        }
        return p;
    }
    return GifWriter;
}();
animatedGif = function (workerCode) {
    // A library/utility for generating GIF files
    // Uses Dean McNamee's omggif library
    // and Anthony Dekker's NeuQuant quantizer (JS 0.3 version with many fixes)
    //
    // @author sole / http://soledadpenades.com
    function Animated_GIF(options) {
        
        var GifWriter = gifWriter;
        var width = options.width || 160;
        var height = options.height || 120;
        var dithering = options.dithering || null;
        var palette = options.palette || null;
        var canvas = null, ctx = null, repeat = 0, delay = 250;
        var frames = [];
        var numRenderedFrames = 0;
        var onRenderCompleteCallback = function () {
        };
        var onRenderProgressCallback = function () {
        };
        var sampleInterval;
        var workers = [], availableWorkers = [], numWorkers, workerPath;
        var generatingGIF = false;
        options = options || {};
        sampleInterval = options.sampleInterval || 10;
        numWorkers = options.numWorkers || 2;
        workerPath = options.workerPath || 'Animated_GIF.worker.js';
        // TODO possible to find our path?
        for (var i = 0; i < numWorkers; i++) {
            var webWorkerObj = utils.createWebWorker(workerCode), objectUrl = webWorkerObj.objectUrl, w = webWorkerObj.worker;
            workers.push({
                'worker': w,
                'objectUrl': objectUrl
            });
            availableWorkers.push(w);
        }
        // ---
        // Return a worker for processing a frame
        function getWorker() {
            if (availableWorkers.length === 0) {
                throw 'No workers left!';
            }
            return availableWorkers.pop();
        }
        // Restore a worker to the pool
        function freeWorker(worker) {
            availableWorkers.push(worker);
        }
        // Faster/closurized bufferToString function
        // (caching the String.fromCharCode values)
        var bufferToString = function () {
                var byteMap = [];
                for (var i = 0; i < 256; i++) {
                    byteMap[i] = String.fromCharCode(i);
                }
                return function (buffer) {
                    var numberValues = buffer.length;
                    var str = '';
                    for (var i = 0; i < numberValues; i++) {
                        str += byteMap[buffer[i]];
                    }
                    return str;
                };
            }();
        function startRendering(completeCallback) {
            var numFrames = frames.length;
            onRenderCompleteCallback = completeCallback;
            for (var i = 0; i < numWorkers && i < frames.length; i++) {
                processFrame(i);
            }
        }
        function processFrame(position) {
            var frame;
            var worker;
            frame = frames[position];
            if (frame.beingProcessed || frame.done) {
                console.error('Frame already being processed or done!', frame.position);
                onFrameFinished();
                return;
            }
            frame.sampleInterval = sampleInterval;
            frame.beingProcessed = true;
            worker = getWorker();
            worker.onmessage = function (ev) {
                var data = ev.data;
                // Delete original data, and free memory
                delete frame.data;
                // TODO grrr... HACK for object -> Array
                frame.pixels = Array.prototype.slice.call(data.pixels);
                frame.palette = Array.prototype.slice.call(data.palette);
                frame.done = true;
                frame.beingProcessed = false;
                freeWorker(worker);
                onFrameFinished();
            };
            // TODO transfer objects should be more efficient
            /*var frameData = frame.data;
             //worker.postMessage(frameData, [frameData]);
             worker.postMessage(frameData);*/
            worker.postMessage(frame);
        }
        function processNextFrame() {
            var position = -1;
            for (var i = 0; i < frames.length; i++) {
                var frame = frames[i];
                if (!frame.done && !frame.beingProcessed) {
                    position = i;
                    break;
                }
            }
            if (position >= 0) {
                processFrame(position);
            }
        }
        function onFrameFinished() {
            // ~~~ taskFinished
            // The GIF is not written until we're done with all the frames
            // because they might not be processed in the same order
            var allDone = frames.every(function (frame) {
                    return !frame.beingProcessed && frame.done;
                });
            numRenderedFrames++;
            onRenderProgressCallback(numRenderedFrames * 0.75 / frames.length);
            if (allDone) {
                if (!generatingGIF) {
                    generateGIF(frames, onRenderCompleteCallback);
                }
            } else {
                setTimeout(processNextFrame, 1);
            }
        }
        // Takes the already processed data in frames and feeds it to a new
        // GifWriter instance in order to get the binary GIF file
        function generateGIF(frames, callback) {
            // TODO: Weird: using a simple JS array instead of a typed array,
            // the files are WAY smaller o_o. Patches/explanations welcome!
            var buffer = [];
            // new Uint8Array(width * height * frames.length * 5);
            var globalPalette;
            var gifOptions = { loop: repeat };
            // Using global palette but only if we're also using dithering
            if (dithering !== null && palette !== null) {
                globalPalette = palette;
                gifOptions.palette = globalPalette;
            }
            var gifWriter = new GifWriter(buffer, width, height, gifOptions);
            generatingGIF = true;
            frames.forEach(function (frame, index) {
                var framePalette;
                if (!globalPalette) {
                    framePalette = frame.palette;
                }
                onRenderProgressCallback(0.75 + 0.25 * frame.position * 1 / frames.length);
                gifWriter.addFrame(0, 0, width, height, frame.pixels, {
                    palette: framePalette,
                    delay: delay
                });
            });
            gifWriter.end();
            onRenderProgressCallback(1);
            frames = [];
            generatingGIF = false;
            callback(buffer);
        }
        function powerOfTwo(value) {
            return value !== 0 && (value & value - 1) === 0;
        }
        // ---
        this.setSize = function (w, h) {
            width = w;
            height = h;
            canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            ctx = canvas.getContext('2d');
        };
        // Internally, GIF uses tenths of seconds to store the delay
        this.setDelay = function (seconds) {
            delay = seconds * 0.1;
        };
        // From GIF: 0 = loop forever, null = not looping, n > 0 = loop n times and stop
        this.setRepeat = function (r) {
            repeat = r;
        };
        this.addFrame = function (element) {
            if (ctx === null) {
                this.setSize(width, height);
            }
            ctx.drawImage(element, 0, 0, width, height);
            var imageData = ctx.getImageData(0, 0, width, height);
            this.addFrameImageData(imageData);
        };
        this.addFrameImageData = function (imageData) {
            var dataLength = imageData.length, imageDataArray = new Uint8Array(imageData.data);
            frames.push({
                data: imageDataArray,
                width: imageData.width,
                height: imageData.height,
                palette: palette,
                dithering: dithering,
                done: false,
                beingProcessed: false,
                position: frames.length
            });
        };
        this.onRenderProgress = function (callback) {
            onRenderProgressCallback = callback;
        };
        this.isRendering = function () {
            return generatingGIF;
        };
        this.getBase64GIF = function (completeCallback) {
            var onRenderComplete = function (buffer) {
                var str = bufferToString(buffer);
                var gif = 'data:image/gif;base64,' + btoa(str);
                completeCallback(gif);
            };
            startRendering(onRenderComplete);
        };
        this.getBlobGIF = function (completeCallback) {
            var onRenderComplete = function (buffer) {
                var array = new Uint8Array(buffer);
                var blob = new Blob([array], { type: 'image/gif' });
                completeCallback(blob);
            };
            startRendering(onRenderComplete);
        };
        // Once this function is called, the object becomes unusable
        // and you'll need to create a new one.
        this.destroy = function () {
            // Explicitly ask web workers to die so they are explicitly GC'ed
            workers.forEach(function (workerObj) {
                var worker = workerObj.worker, objectUrl = workerObj.objectUrl;
                worker.terminate();
                utils.URL.revokeObjectURL(objectUrl);
            });
        };
    }
    return Animated_GIF;
}(worker);
screenShot = function (Animated_GIF) {
    return {
        getWebcamGif: function (obj, callback) {
            callback = utils.isFunction(callback) ? callback : function () {
            };
            var canvas = document.createElement('canvas'), context, videoElement = obj.videoElement, cameraStream = obj.cameraStream, gifWidth = obj.gifWidth, gifHeight = obj.gifHeight, videoWidth = obj.videoWidth, videoHeight = obj.videoHeight, sampleInterval = obj.sampleInterval, numWorkers = obj.numWorkers, crop = obj.crop, interval = obj.interval, progressCallback = obj.progressCallback, numFrames = obj.numFrames, pendingFrames = numFrames, ag = new Animated_GIF({
                    'sampleInterval': sampleInterval,
                    'numWorkers': numWorkers
                }), sourceX = Math.floor(crop.scaledWidth / 2), sourceWidth = videoWidth - crop.scaledWidth, sourceY = Math.floor(crop.scaledHeight / 2), sourceHeight = videoHeight - crop.scaledHeight, captureFrame = function () {
                    var framesLeft = pendingFrames - 1;
                    context.drawImage(videoElement, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, gifWidth, gifHeight);
                    ag.addFrameImageData(context.getImageData(0, 0, gifWidth, gifHeight));
                    pendingFrames = framesLeft;
                    // Call back with an r value indicating how far along we are in capture
                    progressCallback((numFrames - pendingFrames) / numFrames);
                    if (framesLeft > 0) {
                        setTimeout(captureFrame, interval * 1000);
                    }
                    if (!pendingFrames) {
                        ag.getBase64GIF(function (image) {
                            // Ensure workers are freed-so we avoid bug #103
                            // https://github.com/meatspaces/meatspace-chat/issues/103
                            ag.destroy();
                            callback({
                                'error': false,
                                'errorCode': '',
                                'errorMsg': '',
                                'image': image,
                                'cameraStream': cameraStream,
                                'videoElement': videoElement
                            });
                        });
                    }
                };
            numFrames = numFrames !== undefined ? numFrames : 3;
            interval = interval !== undefined ? interval : 0.1;
            // In seconds
            canvas.width = gifWidth;
            canvas.height = gifHeight;
            context = canvas.getContext('2d');
            ag.setSize(gifWidth, gifHeight);
            ag.setDelay(interval);
            captureFrame();
        },
        'getCropDimensions': function (obj) {
            var width = obj.videoWidth, height = obj.videoHeight, gifWidth = obj.gifWidth, gifHeight = obj.gifHeight, result = {
                    width: 0,
                    height: 0,
                    scaledWidth: 0,
                    scaledHeight: 0
                };
            if (width > height) {
                result.width = Math.round(width * (gifHeight / height)) - gifWidth;
                result.scaledWidth = Math.round(result.width * (height / gifHeight));
            } else {
                result.height = Math.round(height * (gifWidth / width)) - gifHeight;
                result.scaledHeight = Math.round(result.height * (width / gifWidth));
            }
            return result;
        }
    };
}(animatedGif);
error = function () {
    var error = {
            'validate': function () {
                var errorObj = {};
                utils.each(error.validators, function (indece, currentValidator) {
                    if (!currentValidator.condition) {
                        errorObj = currentValidator;
                        errorObj.error = true;
                        return false;
                    }
                });
                delete errorObj.condition;
                return errorObj;
            },
            'isValid': function () {
                var errorObj = error.validate(), isValid = errorObj.error !== true ? true : false;
                return isValid;
            },
            'validators': [
                {
                    'condition': utils.isFunction(utils.getUserMedia),
                    'errorCode': 'getUserMedia',
                    'errorMsg': 'The getUserMedia API is not supported in your browser'
                },
                {
                    'condition': utils.isSupported.canvas(),
                    'errorCode': 'canvas',
                    'errorMsg': 'Canvas elements are not supported in your browser'
                },
                {
                    'condition': utils.isSupported.webworkers(),
                    'errorCode': 'webworkers',
                    'errorMsg': 'The Web Workers API is not supported in your browser'
                },
                {
                    'condition': utils.isFunction(utils.URL),
                    'errorCode': 'window.URL',
                    'errorMsg': 'The window.URL API is not supported in your browser'
                },
                {
                    'condition': utils.isSupported.blob(),
                    'errorCode': 'window.Blob',
                    'errorMsg': 'The window.Blob File API is not supported in your browser'
                },
                {
                    'condition': utils.isFunction(window.btoa),
                    'errorCode': 'window.btoa',
                    'errorMsg': 'The window.btoa base-64 encoding method is not supported in your browser'
                },
                {
                    'condition': utils.isFunction(Uint8Array),
                    'errorCode': 'window.Uint8Array',
                    'errorMsg': 'The window.Uint8Array function constructor is not supported in your browser'
                },
                {
                    'condition': utils.isFunction(Uint32Array),
                    'errorCode': 'window.Uint32Array',
                    'errorMsg': 'The window.Uint32Array function constructor is not supported in your browser'
                }
            ]
        };
    return error;
}();
index = function (animated_GIF) {
    var gifshot = {
            'defaultOptions': {
                'sampleInterval': 10,
                'numWorkers': 2,
                'gifWidth': 200,
                'gifHeight': 200,
                'interval': 0.1,
                'numFrames': 10,
                'keepCameraOn': false,
                'progressCallback': function (captureProgress) {
                },
                'completeCallback': function () {
                }
            },
            'options': {},
            'animated_GIF': animated_GIF,
            'createGIF': function (userOptions, callback) {
                callback = utils.isFunction(userOptions) ? userOptions : callback;
                userOptions = utils.isObject(userOptions) ? userOptions : {};
                if (!utils.isFunction(callback)) {
                    return;
                } else if (!gifshot.isSupported()) {
                    return callback(error.validate());
                }
                var self = this, defaultOptions = gifshot.defaultOptions, options = this.options = utils.mergeOptions(defaultOptions, userOptions), lastCameraStream = userOptions.cameraStream, numFrames = options.numFrames, interval = options.interval, wait = interval * 10000;
                videoStream.startVideoStreaming(function (obj) {
                    var cameraStream = obj.cameraStream, videoElement = obj.videoElement, videoWidth = obj.videoWidth, videoHeight = obj.videoHeight, gifWidth = options.gifWidth, gifHeight = options.gifHeight, cropDimensions = screenShot.getCropDimensions({
                            'videoWidth': videoWidth,
                            'videoHeight': videoHeight,
                            'gifHeight': gifHeight,
                            'gifWidth': gifWidth
                        }), completeCallback = callback;
                    options.crop = cropDimensions;
                    options.videoElement = videoElement;
                    options.videoWidth = videoWidth;
                    options.videoHeight = videoHeight;
                    options.cameraStream = cameraStream;
                    if (!utils.isElement(videoElement)) {
                        return;
                    }
                    videoElement.src = utils.URL.createObjectURL(cameraStream);
                    videoElement.width = gifWidth + cropDimensions.width;
                    videoElement.height = gifHeight + cropDimensions.height;
                    utils.setCSSAttr(videoElement, {
                        'position': 'absolute',
                        'width': gifWidth + cropDimensions.videoWidth + 'px',
                        'height': gifHeight + cropDimensions.videoHeight + 'px',
                        'left': -Math.floor(cropDimensions.videoWidth / 2) + 'px',
                        'top': -Math.floor(cropDimensions.videoHeight / 2) + 'px',
                        'opacity': '0'
                    });
                    document.body.appendChild(videoElement);
                    // Firefox doesn't seem to obey autoplay if the element is not in the DOM when the content
                    // is loaded, so we must manually trigger play after adding it, or the video will be frozen
                    videoElement.play();
                    setTimeout(function () {
                        screenShot.getWebcamGif(options, function (obj) {
                            gifshot.stopVideoStreaming(obj);
                            if (obj.videoElement) {
                                delete obj.videoElement;
                            }
                            completeCallback(obj);
                        });
                    }, wait);
                }, {
                    'lastCameraStream': lastCameraStream,
                    'callback': callback
                });
            },
            'takeSnapShot': function (obj, callback) {
                var defaultOptions = utils.mergeOptions(gifshot.defaultOptions, obj), options = utils.mergeOptions(defaultOptions, {
                        'interval': 0.1,
                        'numFrames': 1
                    });
                this.createGIF(options, callback);
            },
            'stopVideoStreaming': function (obj) {
                obj = utils.isObject(obj) ? obj : {};
                var self = this, options = utils.isObject(self.options) ? self.options : {}, cameraStream = obj.cameraStream, videoElement = obj.videoElement;
                videoStream.stopVideoStreaming({
                    'cameraStream': cameraStream,
                    'videoElement': videoElement,
                    'keepCameraOn': options.keepCameraOn
                });
            },
            'isSupported': function () {
                return error.isValid();
            }
        };
    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js, and plain browser loading
    if (typeof define === 'function' && define.amd) {
        define('gifshot', [], function () {
            return gifshot;
        });
    } else if (typeof exports !== 'undefined') {
        module.exports = gifshot;
    } else {
        window.gifshot = gifshot;
    }
}(animatedGif);
}(window, window.navigator, document));