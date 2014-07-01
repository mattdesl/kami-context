# kami-context

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

WebGL context creation for kami. This is much like [webgl-context](http://github.com/mattdesl/webgl-context), however, it includes a couple of convenience features, and also attempts to handle context loss events when used alongside other kami modules.

## Usage

[![NPM](https://nodei.co/npm/kami-context.png)](https://nodei.co/npm/kami-context/)

```js
//create a WebGL canvas and context...
var context = require('kami-context')({
	width: 500,
	height: 250,
	attributes: {
		antialias: true
	}
});

//append it to the DOM
document.body.appendChild( context.canvas );

//use it alongside other kami modules...
var tex = require('kami-texture')(context, {
	src: 'img.png'
});
```

Options:

- `width` - sets the width of the canvas
- `height` - sets the height of the canvas
- `attributes` - the attributes to pass to the getContext call
- `handleContextLoss` - default true; whether to try and handle context loss (no "Rats! WebGL Hit a Snag!" message)
- `usePixelRatio` - default true; tries to handle retina displays by scaling the canvas with CSS

If you want, you can specify `gl` to the options, and it will use that WebGLRenderingContext (and its canvas) instead of re-requesting one. This is handy when using debuggers like WebGLInspector, which don't play as nicely with multiple calls to getContext. 

If you didn't specify `gl`, you can instead pass `canvas` which uses a pre-existing canvas element rather than creating a new one. 

## properties

- `gl` the actual WebGLRenderingContext. 
- `width` the width of the context
- `height` the height of the context
- `canvas` the canvas

## events

- `lost` a signal dispatched when the context is lost
- `restored` a signal dispatched after the context has been restored

## methods

### `resize(width, height)`

Resizes the context and viewport to the given size. By default; this will resize the canvas based on devicePixelRatio, and then scale it back down with CSS for retina displays. You can disable this by specifying `devicePixelRatio` as false in the constructor or before calling resize.

### `destroy()`

This is a convenience function to call `destroy()` on each 'managed object'. A 'managed object' is a kami module (like texture or shader) which has been created with this `kami-context` passed to its constructor.

It also clears references to the canvas and WebGLRenderingContext.



## License

MIT, see [LICENSE.md](http://github.com/mattdesl/kami-context/blob/master/LICENSE.md) for details.
