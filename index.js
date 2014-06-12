/**
 * @module kami-context
 */

var Class = require('klasse');
var Signal = require('signals');
var getContext = require('webgl-context');

/**
 * A thin wrapper around WebGLRenderingContext which handles
 * context loss and restore with various rendering objects (textures,
 * shaders and buffers). This also handles general viewport management.
 *
 * If the `canvas` option isn't specified, a new canvas will be created.
 *
 * If `gl` is specified and is an instance of WebGLRenderingContext, the `canvas` 
 * and `attributes` options will be ignored and we will use `gl` without fetching another `getContext`.
 * Providing a canvas that has `getContext('webgl')` already called will not cause
 * errors, but in certain debuggers (e.g. Chrome WebGL Inspector), only the latest
 * context will be traced.
 * 
 * @class  WebGLContext
 * @constructor
 * @param {Number} options.width the width of the GL canvas
 * @param {Number} options.height the height of the GL canvas
 * @param {HTMLCanvasElement} options.canvas the optional DOM canvas element
 * @param {Object} options.attributes an object containing context attribs which
 *                                   will be used during GL initialization
 * @param {WebGLRenderingContext} options.gl the already-initialized GL context to use
 */
var WebGLContext = new Class({

    initialize: function WebGLContext(options) {
        if (!(this instanceof WebGLContext))
            return new WebGLContext(options);
        options = options||{};

        var width = options.width;
        var height = options.height;
        var view = options.canvas;
        var gl = options.gl;
        var contextAttributes = options.contextAttributes;

        /**
         * The list of rendering objects (shaders, VBOs, textures, etc) which are 
         * currently being managed. Any object with a "create" method can be added
         * to this list. Upon destroying the rendering object, it should be removed.
         * See addManagedObject and removeManagedObject.
         * 
         * @property {Array} managedObjects
         */
        this.managedObjects = [];

        /**
         * The actual GL context. You can use this for
         * raw GL calls or to access GLenum constants. This
         * will be updated on context restore. While the WebGLContext
         * is not `valid`, you should not try to access GL state.
         * 
         * @property gl
         * @type {WebGLRenderingContext}
         */
        this.gl = null;

        //if the user specified a GL context..
        if (gl && typeof window.WebGLRenderingContext !== "undefined"
               && gl instanceof window.WebGLRenderingContext) {
            view = gl.canvas;
            this.gl = gl;
            this.valid = true;
            contextAttributes = undefined; //just ignore new attribs...
        }

        /**
         * The canvas DOM element for this context.
         * @property {HTMLCanvasElement} canvas
         */
        this.canvas = view || document.createElement("canvas");

        /**
         * The width of this canvas.
         *
         * @property width
         * @type {Number}
         */
        if (typeof width==="number") 
            this.width = this.canvas.width = width;
        else //if no size is specified, use canvas size
            this.width = this.canvas.width;

        /**
         * The height of this canvas.
         * @property height
         * @type {Number}
         */
        if (typeof height==="number")
            this.height = this.canvas.height = height;
        else //if no size is specified, use canvas size
            this.height = this.canvas.height;

        /**
         * The context attributes for initializing the GL state. This might include
         * anti-aliasing, alpha settings, verison, and so forth.
         * 
         * @property {Object} contextAttributes 
         */
        this.contextAttributes = contextAttributes;
        
        /**
         * Whether this context is 'valid', i.e. renderable. A context that has been lost
         * (and not yet restored) or destroyed is invalid.
         * 
         * @property {Boolean} valid
         */
        this.valid = false;

        /**
         * A signal dispatched when GL context is lost. 
         * 
         * The first argument passed to the listener is the WebGLContext
         * managing the context loss.
         * 
         * @event {Signal} lost
         */
        this.lost = new Signal();

        /**
         * A signal dispatched when GL context is restored, after all the managed
         * objects have been recreated.
         *
         * The first argument passed to the listener is the WebGLContext
         * which managed the restoration.
         *
         * This does not gaurentee that all objects will be renderable.
         * For example, a Texture with an ImageProvider may still be loading
         * asynchronously.   
         * 
         * @event {Signal} restored
         */
        this.restored = new Signal();   
        
        //setup context lost and restore listeners
        this.canvas.addEventListener("webglcontextlost", function (ev) {
            ev.preventDefault();
            this._contextLost(ev);
        }.bind(this));
        this.canvas.addEventListener("webglcontextrestored", function (ev) {
            ev.preventDefault();
            this._contextRestored(ev);
        }.bind(this));
            
        if (!this.valid) //would only be valid if WebGLRenderingContext was passed 
            this._initContext();

        this.resize(this.width, this.height);
    },
    
    _initContext: function() {
        var err = "";
        this.valid = false;
        this.gl = getContext({
            canvas: this.canvas,
            attributes: this.contextAttributes
        });

        if (this.gl) {
            this.valid = true;
        } else {
            throw new Error("WebGL Context Not Supported -- try enabling it or using a different browser");
        }   
    },

    /**
     * Updates the width and height of this WebGL context, resizes
     * the canvas view, and calls gl.viewport() with the new size.
     * 
     * @param  {Number} width  the new width
     * @param  {Number} height the new height
     */
    resize: function(width, height) {
        this.width = width;
        this.height = height;

        this.canvas.width = width;
        this.canvas.height = height;

        var gl = this.gl;
        gl.viewport(0, 0, this.width, this.height);
    },

    /**
     * (internal use)
     * A managed object is anything with a "create" function, that will
     * restore GL state after context loss. 
     * 
     * @param {[type]} tex [description]
     */
    addManagedObject: function(obj) {
        this.managedObjects.push(obj);
    },

    /**
     * (internal use)
     * Removes a managed object from the cache. This is useful to destroy
     * a texture or shader, and have it no longer re-load on context restore.
     *
     * Returns the object that was removed, or null if it was not found in the cache.
     * 
     * @param  {Object} obj the object to be managed
     * @return {Object}     the removed object, or null
     */
    removeManagedObject: function(obj) {
        var idx = this.managedObjects.indexOf(obj);
        if (idx > -1) {
            this.managedObjects.splice(idx, 1);
            return obj;
        } 
        return null;
    },

    /**
     * Calls destroy() on each managed object, then removes references to these objects
     * and the GL rendering context. This also removes references to the view and sets
     * the context's width and height to zero.
     *
     * Attempting to use this WebGLContext or the GL rendering context after destroying it
     * will lead to undefined behaviour.
     */
    destroy: function() {
        for (var i=0; i<this.managedObjects.length; i++) {
            var obj = this.managedObjects[i];
            if (obj && typeof obj.destroy === "function")
                obj.destroy();
        }
        this.managedObjects.length = 0;
        this.valid = false;
        this.gl = null;
        this.canvas = null;
        this.width = this.height = 0;
    },

    _contextLost: function(ev) {
        //all textures/shaders/buffers/FBOs have been deleted... 
        //we need to re-create them on restore
        this.valid = false;

        this.lost.dispatch(this);
    },

    _contextRestored: function(ev) {
        //first, initialize the GL context again
        this._initContext();

        //now we recreate our shaders and textures
        for (var i=0; i<this.managedObjects.length; i++) {
            this.managedObjects[i].create();
        }

        //update GL viewport
        this.resize(this.width, this.height);

        this.restored.dispatch(this);
    },

    /**
     * Backward-compatible view getter/setter.
     * Deprecated, may be removed in the future.
     * 
     * @deprecated use canvas instead
     * @property {HTMLCanvas} view 
     */
    view: {
        get: function() {
            return this.canvas;
        },
        set: function(canvas) {
            this.canvas = canvas;
        }
    }
});

module.exports = WebGLContext;