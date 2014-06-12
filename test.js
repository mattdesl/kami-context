var test = require('tape').test;
var WebGLContext = require('./');

test('testing context creation', function(t) {
	var ctx = new WebGLContext({
        width: 153,
        height: 234
    });
    t.ok(ctx.canvas.width===153 && ctx.canvas.height===234, 'creates a new canvas');

    var ctx2 = new WebGLContext({
        canvas: ctx.canvas
    });
    t.ok(ctx2.width===153 && ctx2.height===234, 'can reuse a previous canvas');    

    //testing non-constructor..
    var ctx3 = WebGLContext({
        gl: ctx2.gl
    });
    t.ok(ctx3.gl === ctx2.gl && ctx3.canvas === ctx2.canvas, 'can reuse a previous GL context');

    var ctx4 = new WebGLContext();
    t.ok(ctx4.gl && ctx4.canvas && ctx4.width > 0, 'creates a new empty canvas');

    t.end();
});