"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pubsub_async_iterator_1 = require("./pubsub-async-iterator");
var RedisPubSub = (function () {
    function RedisPubSub(options) {
        if (options === void 0) { options = {}; }
        this.triggerTransform = options.triggerTransform || (function (trigger) { return trigger; });
        if (options.subscriber && options.publisher) {
            this.redisPublisher = options.publisher;
            this.redisSubscriber = options.subscriber;
        }
        else {
            try {
                var IORedis = require('ioredis');
                this.redisPublisher = new IORedis(options.connection);
                this.redisSubscriber = new IORedis(options.connection);
                if (options.connectionListener) {
                    this.redisPublisher.on('connect', options.connectionListener);
                    this.redisPublisher.on('error', options.connectionListener);
                    this.redisSubscriber.on('connect', options.connectionListener);
                    this.redisSubscriber.on('error', options.connectionListener);
                }
                else {
                    this.redisPublisher.on('error', console.error);
                    this.redisSubscriber.on('error', console.error);
                }
            }
            catch (error) {
                console.error("Nor publisher or subscriber instances were provided and the package 'ioredis' wasn't found. \n        Couldn't create Redis clients.");
            }
        }
        this.redisSubscriber.on('pmessage', this.onMessage.bind(this));
        this.subscriptionMap = {};
        this.subsRefsMap = {};
        this.currentSubscriptionId = 0;
    }
    RedisPubSub.prototype.publish = function (trigger, payload) {
        return this.redisPublisher.publish(trigger, JSON.stringify(payload));
    };
    RedisPubSub.prototype.subscribe = function (trigger, onMessage, options) {
        var _this = this;
        var triggerName = this.triggerTransform(trigger, options);
        var id = this.currentSubscriptionId++;
        this.subscriptionMap[id] = [triggerName, onMessage];
        var refs = this.subsRefsMap[triggerName];
        if (refs && refs.length > 0) {
            var newRefs = refs.concat([id]);
            this.subsRefsMap[triggerName] = newRefs;
            return Promise.resolve(id);
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.redisSubscriber.psubscribe(triggerName, function (err) {
                    if (err) {
                        reject(err);
                    }
                    else {
                        _this.subsRefsMap[triggerName] = (_this.subsRefsMap[triggerName] || []).concat([id]);
                        resolve(id);
                    }
                });
            });
        }
    };
    RedisPubSub.prototype.unsubscribe = function (subId) {
        var _a = (this.subscriptionMap[subId] || [])[0], triggerName = _a === void 0 ? null : _a;
        var refs = this.subsRefsMap[triggerName];
        if (!refs)
            throw new Error("There is no subscription of id \"" + subId + "\"");
        if (refs.length === 1) {
            this.redisSubscriber.unsubscribe(triggerName);
            delete this.subsRefsMap[triggerName];
        }
        else {
            var index = refs.indexOf(subId);
            var newRefs = index === -1 ? refs : refs.slice(0, index).concat(refs.slice(index + 1));
            this.subsRefsMap[triggerName] = newRefs;
        }
        delete this.subscriptionMap[subId];
    };
    RedisPubSub.prototype.asyncIterator = function (triggers) {
        return new pubsub_async_iterator_1.PubSubAsyncIterator(this, triggers);
    };
    RedisPubSub.prototype.getSubscriber = function () {
        return this.redisSubscriber;
    };
    RedisPubSub.prototype.getPublisher = function () {
        return this.redisPublisher;
    };
    RedisPubSub.prototype.onMessage = function (pattern, channel, message) {
        var subscribers = this.subsRefsMap[pattern];
        if (!subscribers || !subscribers.length)
            return;
        var parsedMessage;
        try {
            parsedMessage = JSON.parse(message);
        }
        catch (e) {
            parsedMessage = message;
        }
        for (var _i = 0, subscribers_1 = subscribers; _i < subscribers_1.length; _i++) {
            var subId = subscribers_1[_i];
            var listener = this.subscriptionMap[subId][1];
            listener(parsedMessage);
        }
    };
    return RedisPubSub;
}());
exports.RedisPubSub = RedisPubSub;
//# sourceMappingURL=redis-pubsub.js.map