2D Spline Curves
CS 4620 Lecture 18

Motivation: smoothness
• In many applications we need smooth shapes
– that is, without discontinuities
ie
• So far we can make
– things with corners (lines, triangles, squares, rectangles, …)
– circles, ellipses, other special shapes (only get you so far!)

Classical approach
• Pencil-and-paper draftsmen also needed smooth
curves
• Origin of “spline:” strip of flexible metal
– held in place by pegs or weights to constrain shape
– traced to produce smooth contour

Translating into usable math
• Smoothness
– in drafting spline, comes from physical curvature
minimization
– in CG spline, comes from choosing smooth functions
• usually low-order polynomials
• Control
– in drafting spline, comes from fixed pegs
– in CG spline, comes from user-specified control points

Defining spline curves
• At the most general they are parametric curves
• For splines, f(t) is piecewise polynomial
– for this lecture, the discontinuities are at the integers

Defining spline curves
• Generally f(t) is a piecewise polynomial
– for this lecture, the discontinuities are at the integers
– e.g., a cubic spline has the following form over [k, k + 1]:
– Coefficients are different for every interval

Coordinate functions

Coordinate functions

Control of spline curves
• Specified by a sequence of controls (points or vectors)
• Shape is guided by control points (aka control polygon)
– interpolating: passes through points
– approximating: merely guided by points

How splines depend on their controls
• Each coordinate is separate
– the function x(t) is determined solely by the x coordinates of
the control points
– this means 1D, 2D, 3D, … curves are all really the same
• Spline curves are linear functions of their controls
– moving a control point two inches to the right moves x(t)
twice as far as moving it by one inch
– x(t), for fixed t, is a linear combination (weighted sum) of the
controls’ x coordinates
– f(t), for fixed t, is a linear combination (weighted sum) of the
controls

Plan
• Spline segments
– how to define a polynomial on [0,1]
– …that has the properties you want
– …and is easy to control
• Spline curves
– how to chain together lots of segments
– …so that the whole curve has the properties you want
– …and is easy to control
• Refinement and evaluation
– how to add detail to splines
– how to approximate them with line segments

Spline Segments

Trivial example: piecewise linear
• This spline is just a polygon
– control points are the vertices
• But we can derive it anyway as an illustration
• Each interval will be a linear function
| – x(t) = at | + b |     |
| ----------- | --- | --- |
– constraints are values at endpoints
| – b = x | ; a = x | – x |
| ------- | ------- | --- |
|         | 0       | 1 0 |
– this is linear interpolation

Trivial example: piecewise linear
• Vector formulation
• Matrix formulation

Trivial example: piecewise linear
• Basis function formulation
– regroup expression by p rather than t
– interpretation in matrix viewpoint

Trivial example: piecewise linear
• Vector blending formulation: “average of points”
– blending functions: contribution of each point as t changes

Hermite splines
• Less trivial example
• Form of curve: piecewise cubic
• Constraints: endpoints and tangents (derivatives)

Hermite splines
• Solve constraints to find coefficients

Matrix form of spline

Hermite splines
• Matrix form is much simpler
– coefficients = rows
– basis functions = columns
• note p columns sum to [0 0 0 1]T

Hermite splines
• Hermite blending functions

Hermite to Bézier
• Mixture of points and vectors is awkward
• Specify tangents as differences of points
I’m calling these points
q just for this slide and
the next one.
– note derivative is defined as 3 times offset
• reason is illustrated by linear case

Hermite to Bézier

Bézier matrix
– note that these are the Bernstein polynomials
and that defines Bézier curves for any degree

Bézier basis

Another way to Bézier segments
• A really boring spline segment: f(t) = p
– it only has one control point
– the curve stays at that point for the whole time
• Only good for building a piecewise constant spline
– a.k.a. a set of points

Another way to Bézier segments
• A piecewise linear spline segment
– two control points per segment
– blend them with weights α and β = 1 – α
• Good for building a
piecewise linear spline
– a.k.a. a polygon or polyline
These labels show the
weights, not the distances.

Another way to Bézier segments
• A linear blend of two piecewise linear segments
– three control points now
– interpolate on both segments using α and β
– blend the results with the same weights
• makes a quadratic spline segment
– finally, a curve!


Another way to Bézier segments
• Cubic segment: blend of two quadratic segments
– four control points now (overlapping sets of 3)
– interpolate on each quadratic using α and β
– blend the results with the same weights
• makes a cubic spline segment
– this is the familiar one for graphics—but you can keep going


de Casteljau’s algorithm
• A recurrence for computing points on Bézier spline
segments:
• Cool additional feature:
also subdivides
the segment into two
shorter ones

Cubic Bézier splines
• Very widely used type, especially in 2D
– e.g. it is a primitive in PostScript/PDF
• Can represent smooth curves with corners
• Nice de Casteljau recurrence for evaluation
• Can easily add points at any position
• Illustrator demo

Spline Curves

Chaining spline segments
• Can only do so much with a single polynomial
• Can use these functions as segments of a longer curve
| – curve from t | = 0 to t | = 1 defined by first segment  |
| -------------- | -------- | ----------------------------- |
| – curve from t | = 1 to t | = 2 defined by second segment |
• To avoid discontinuity, match derivatives at junctions
| – this produces a C1 | curve |     |
| -------------------- | ----- | --- |

Trivial example: piecewise linear
• Basis function formulation: “function times point”
– basis functions: contribution of each point as t changes
– can think of them as blending functions glued together
– this is just like a reconstruction filter!

Seeing the basis functions
• Basis functions of a spline are revealed by how the
curve changes in response to a change in one control
– to get a graph of the basis function, start with the curve laid
out in a straight, constant-speed line
• what are x(t) and y(t)?
– then move one control straight up

Hermite splines
• Constraints are endpoints
and endpoint tangents

Hermite basis

Bézier basis

Chaining Bézier splines
• No continuity built in
• Achieve C1 using collinear control points

Continuity
• Smoothness can be described by degree of continuity
– zero-order (C0): position matches from both sides
– first-order (C1): tangent matches from both sides
– second-order (C2): curvature matches from both sides
– Gn vs. Cn
zero order first order second order

Continuity
• Parametric continuity (C) of spline is continuity of
coordinate functions
• Geometric continuity (G) is continuity of the curve
itself
• Neither form of continuity is guaranteed by the other
– Can be C1 but not G1 when p(t) comes to a halt (next slide)
– Can be G1 but not C1 when the tangent vector changes length
abruptly

Geometric vs. parametric continuity

Control
• Local control
– changing control point only affects a limited part of spline
– without this, splines are very difficult to use
– many likely formulations lack this
• natural spline
• polynomial fits

Control
• Convex hull property
– convex hull = smallest convex region containing points
• think of a rubber band around some pins
– some splines stay inside convex hull of control points
• make clipping, culling, picking, etc. simpler
YES YES YES NO

Convex hull
• If basis functions are all positive, the spline has the
convex hull property
– we’re still requiring them to sum to 1
– if any basis function is ever negative, no convex hull prop.
• proof: take the other three points at the same place

Affine invariance
• Transforming the control points is the same as
transforming the curve
– true for all commonly used splines
– extremely convenient in practice…

Affine invariance
• Basis functions associated with points should always
sum to 1

Chaining spline segments
• Hermite curves are convenient because they can be
made long easily
• Bézier curves are convenient because their controls are
all points
– but it is fussy to maintain continuity constraints
– and they interpolate every 3rd point, which is a little odd
• We derived Bézier from Hermite by defining tangents
from control points
– a similar construction leads to the interpolating Catmull-Rom
spline

Hermite to Catmull-Rom
• Have not yet seen any interpolating splines
• Would like to define tangents automatically
– use adjacent control points
– end tangents: extra points or zero

Hermite to Catmull-Rom
| • Tangents are (p | – p | ) / 2 |
| ----------------- | --- | ----- |
| k + 1             | k – | 1     |
– scaling based on same argument about collinear case

Catmull-Rom basis

Catmull-Rom splines
• Our first example of an interpolating spline
• Like Bézier, equivalent to Hermite
– in fact, all splines of this form are equivalent
• First example of a spline based on just a control point
sequence
• Does not have convex hull property

B-splines
• We may want more continuity than C1
• We may not need an interpolating spline
• B-splines are a clean, flexible way of making long
splines with arbitrary order of continuity
• Various ways to think of construction
– a simple one is convolution
– relationship to sampling and reconstruction

Cubic B-spline basis

Deriving the B-Spline
• Approached from a different tack than Hermite-style
constraints
– Want a cubic spline; therefore 4 active control points
– Want C2 continuity
– Turns out that is enough to determine everything

Efficient construction of any B-spline
• B-splines defined for all orders
– order d: degree d – 1
– order d: d points contribute to value
• One definition: Cox-deBoor recurrence

Cubic B-spline matrix

Cubic B-spline basis

Refinement and Evaluation

Converting spline representations
• All the splines we have seen so far are equivalent
– all represented by geometry matrices
• where S represents the type of spline
– therefore the control points may be transformed from one
type to another using matrix multiplication

Refinement of splines
• May want to add more control to a curve
• Can add control by splitting a segment into two
find left and right control points
to make the curves match!

Refinement math

Other types of B-splines
• Nonuniform B-splines
– discontinuities not evenly spaced
– allows control over continuity or interpolation at certain
points
– e.g. interpolate endpoints (commonly used case)
• Nonuniform Rational B-splines (NURBS)
– ratios of nonuniform B-splines: x(t) / w(t); y(t) / w(t)
– key properties:
• invariance under perspective as well as affine
• ability to represent conic sections exactly

Evaluating splines for display
• Need to generate a list of line segments to draw
– generate efficiently
– use as few as possible
– guarantee approximation accuracy
• Approaches
– recursive subdivision (easy to do adaptively)
– uniform sampling (easy to do efficiently)

Evaluating by subdivision
– Recursively split spline
• stop when polygon is
within epsilon of curve
– Termination criteria H
• distance between control points [
• distance of control points from line
• angles in control polygon
p p
1 3

Evaluating with uniform spacing
• Forward differencing
– efficiently generate points for uniformly spaced t values
– evaluate polynomials using repeated differencesProgramming with WebGL
Part 1: Background
Ed Angel
Professor Emeritus of Computer Science
Founding Director, Arts, Research,
Technology and Science Laboratory
University of New Mexico

OpenGL Architecture

Software Organization

A OpenGL Simple Program
Generate a square on a solid background

It used to be easy
#include <GL/glut.h>
void mydisplay(){
|     | glClear(GL_COLOR_BUFFER_BIT); |                         |
| --- | ----------------------------- | ----------------------- |
|     | glBegin(GL_QUAD;              |                         |
|     |                               | glVertex2f(-0.5, -0.5); |
|     |                               | glVertex2f(-0,5, 0,5);  |
|     |                               | glVertex2f(0.5, 0.5);   |
|     |                               | glVertex2f(0.5, -0.5);  |
|     | glEnd()                       |                         |
int main(int argc, char** argv){
|     | glutCreateWindow("simple");      |     |
| --- | -------------------------------- | --- |
|     | glutDisplayFunc(mydisplay);      |     |
|     | glutMainLoop();                  |     |

What happened?
• Most OpenGL functions deprecated
- immediate vs retained mode
- make use of GPU
• Makes heavy use of state variable default
values that no longer exist
- Viewing
- Colors
- Window parameters
• However, processing loop is the same

Execution in Browser

Event Loop
• Remember that the sample program
specifies a render function which is a
event listener or callback function
- Every program should have a render callback
- For a static application we need only execute
the render function once
- In a dynamic application, the render function
can call itself recursively but each redrawing of
the display must be triggered by an event

Lack of Object Orientation
• All versions of OpenGL are not object
oriented so that there are multiple functions
for a given logical function
• Example: sending values to shaders
-gl.uniform3f
-gl.uniform2i
-gl.uniform3dv
• Underlying storage mode is the same

WebGL function format
function name
dimension
gl.uniform3f(x,y,z)
x,y,z are variables
belongs to WebGL canvas
gl.uniform3fv(p)
p is an array

WebGL constants
• Most constants are defined in the canvas
object
- In desktop OpenGL, they were in #include files
such as gl.h
• Examples
-desktop OpenGL
•glEnable(GL_DEPTH_TEST);
-WebGL
•gl.enable(gl.DEPTH_TEST)
-gl.clear(gl.COLOR_BUFFER_BIT)

WebGL and GLSL
• WebGL requires shaders and is based
less on a state machine model than a
data flow model
• Most state variables, attributes and
related pre 3.1 OpenGL functions have
been deprecated
• Action happens in shaders
• Job of application is to get data to GPU

GLSL
• OpenGL Shading Language
• C-like with
- Matrix and vector types (2, 3, 4 dimensional)
- Overloaded operators
- C++ like constructors
• Similar to Nvidia’s Cg and Microsoft HLSL
• Code sent to shaders as source code
• WebGL functions compile, link and get
information to shaders

Programming with OpenGL
Part 2: Complete Programs
Ed Angel
Professor of Emeritus of Computer Science
University of New Mexico

Objectives
• Build a complete first program
- Introduce shaders
- Introduce a standard program structure
• Simple viewing
- Two-dimensional viewing as a special case of
three-dimensional viewing
• Initialization steps and program structure

Square Program

WebGL
• Five steps
- Describe page (HTML file)
• request WebGL Canvas
• read in necessary files
- Define shaders (HTML file)
• could be done with a separate file (browser dependent)
- Compute or specify data (JS file)
- Send data to GPU (JS file)
- Render data (JS file)

square.html
<html>
<script id="vertex-shader" type="x-shader/x-vertex">
#version 300 es
in vec4 vPosition;
void main()
gl_Position = vPosition;
</script>
<script id="fragment-shader" type="x-shader/x-fragment">
#version 300 es
precision mediump float;
out vec4 fColor;
void main()
fColor = vec4( 1.0, 1.0, 1.0, 1.0 );
</script>

Shaders
• We assign names to the shaders that we can
use in the JS file
• These are trivial pass-through (do nothing)
shaders that which set the two variables
- gl_Position
- fragColor
• Note both shaders are full programs
• Note vector type vec2 defined in MV.JS
• Must set precision in fragment shader
• Must give the shader version in WebGL 2.0

square.html (cont)
<script type="text/javascript" src="../Common/initShaders.js"></script>
<script type="text/javascript" src="../Common/MV.js"></script>
<script type="text/javascript" src="square.js"></script>
<body>
<canvas id="gl-canvas" width="512" height="512">>
Oops ... your browser doesn't support the HTML5 canvas element
</canvas>
</body>
</html>

Files
•../Common/initShaders.js: contains
JS and WebGL code for reading, compiling
and linking the shaders
•../Common/MV.js: our matrix-vector
package
•square.js: the application file

square.js
var canvas;
var gl;
window.onload = function init() {
canvas = document.getElementById( "gl-canvas" );
gl = gl = canvas.getContext('webgl2');
if ( !gl ) { alert( "WebGL 2.0 isn't available" ); }
// Four Vertices
var vertices = [
vec2( -0.5, -0.5 ),
vec2( -0.5, 0.5 ),
vec2( 0.5, 0.5 ),
vec2( 0.5, -0.5)
];

Notes
•onload: determines where to start
execution when all code is loaded
• canvas gets WebGL context from HTML file
• vertices use vec2 type in MV.js
• JS array is not the same as a C or Java
array
- object with methods
- vertices.length // 4
• Vertex values in clip coordinates

square.js (cont)
// Configure WebGL
gl.viewport( 0, 0, canvas.width, canvas.height );
gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
// Load shaders and initialize attribute buffers
var program = initShaders( gl, "vertex-shader", "fragment-shader"
);
gl.useProgram( program );
// Load the data into the GPU
var bufferId = gl.createBuffer();
gl.bindBuffer( gl.ARRAY_BUFFER, bufferId );
gl.bufferData( gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW
);
// Associate out shader variable with our data buffer
var vPosition = gl.getAttribLocation( program, "vPosition" );
gl.vertexAttribPointer( vPosition, 2, gl.FLOAT, false, 0, 0 );
gl.enableVertexAttribArray(vPosition);}

Notes
•initShaders used to load, compile and
link shaders to form a program object
• Load data onto GPU by creating a vertex
buffer object on the GPU
- Note use of flatten() in MV.js to convert JS
array to an array of C-like array of float32’s
• Finally we must connect variable in
program with variable in shader
- need name, type, location in buffer

square.js (cont)
render();
};
function render() {
gl.clear( gl.COLOR_BUFFER_BIT );
gl.drawArrays( gl.TRIANGLE_FAN, 0, 4 );
1 2

Triangles, Fans or Strips
gl.drawArrays( gl.TRIANGLES, 0, 6 ); // 0, 1, 2, 0, 2, 3
gl.drawArrays( gl.TRIANGLE_FAN, 0, 4 ); // 0, 1 , 2, 3
| 1   | 2   | 1   | 2   |
| --- | --- | --- | --- |
| 0   | 3   | 0   | 3   |
gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 ); // 0, 1, 3, 2

Objectives
• First example relied on a lot of defaults
• Build a complete first program
- Introduce shaders
- Introduce a standard program structure
• Simple viewing
- Two-dimensional viewing as a special case of
three-dimensional viewing
• Initialization steps and program structure

Program Execution
• WebGL runs within the browser
- complex interaction among the operating
system, the window system, the browser and
your code (HTML and JS)
• Simple model
- Start with HTML file
- files read in asynchronously
- start with onload function
• event driven input

Coordinate Systems
• The units in points are determined by the
application and are called object, world, model or
problem coordinates
• Viewing specifications usually are also in object
coordinates
• Eventually pixels will be produced in window
coordinates
• WebGL also uses some internal representations
that usually are not visible to the application but
are important in the shaders
• Most important is clip coordinates

Coordinate Systems and Shaders
• Vertex shader must output in clip
coordinates
• Input to fragment shader from rasterizer is
in window coordinates
• Application can provide vertex data in any
coordinate system but shader must
eventually produce gl_Position in clip
coordinates
• Simple example uses clip coordinates

WebGL Camera
• WebGL places a camera at the origin in
object space pointing in the negative z
direction
• The default viewing volume
is a box centered at the
origin with sides of
length 2

Orthographic Viewing
In the default orthographic view, points are
projected forward along the z axis onto the
plane z=0
z=0
z=0

Viewports
• Do not have use the entire window for the
image: gl.viewport(x,y,w,h)
• Values in pixels (window coordinates)

Transformations and Viewing
• In WebGL, we usually carry out projection using
a projection matrix (transformation) before
rasterization
• Transformation functions are also used for
changes in coordinate systems
• Pre 3.1 OpenGL had a set of transformation
functions which have been deprecated
• Three choices in WebGL
- Application code
- GLSL functions
- MV.js

Programming with WebGL
Part 3: Shaders
Ed Angel
Professor of Emeritus of Computer Science
University of New Mexico

Objectives
• Simple Shaders
- Vertex shader
- Fragment shaders
• Programming shaders with GLSL
• Finish first program

Vertex Shader Applications
• Moving vertices
- Morphing
- Wave motion
- Fractals
• Lighting
- More realistic models
- Cartoon shaders

Fragment Shader Applications
Per fragment lighting calculations
per vertex lighting
per fragment lighting

Fragment Shader Applications
Texture mapping
smooth shading environment bump mapping
mapping

Writing Shaders
• First programmable shaders were
programmed in an assembly-like manner
• OpenGL extensions added functions for
vertex and fragment shaders
• Cg (C for graphics) C-like language for
programming shaders
- Works with both OpenGL and DirectX
- Interface to OpenGL complex
• OpenGL Shading Language (GLSL)

GLSL
• OpenGL Shading Language
• Part of OpenGL 2.0 and up
• High level C-like language
• New data types
- Matrices
- Vectors
- Samplers
• As of OpenGL 3.1, application must
provide shaders

Simple Vertex Shader
(WebGL 2.0)
#version 300 es compiler directive
input from application
in vec4 vPosition;
void main(void)
gl_Position = vPosition;
built in variable

Simple Vertex Shader
(WebGL 1.0)
input from application
attribute vec4 vPosition;
void main(void)
gl_Position = vPosition;
built in variable

Execution Model
Vertex data
Shader Program
GPU
Vertex Primitive
Application
Shader Assembly
Program
gl.drawArrays
Vertex

Simple Fragment Program
(WebGL 2.0)
#version 300 es compiler directive
precision mediump float; required
out fragColor;
void main(void)
fragColor = vec4(1.0, 0.0, 0.0, 1.0);
built in variable

Simple Fragment Program
(WebGL 1.0)
precision mediump float;
void main(void)
gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
built in variable

Execution Model
Application
Shader Program
Fragment Frame
Rasterizer
Shader Buffer
Vertex Fragment Fragment
Color

Data Types
• C types: int, float, bool
• Vectors:
- float vec2, vec3, vec4
- Also int (ivec) and boolean (bvec)
• Matrices: mat2, mat3, mat4
- Stored by columns
- Standard referencing m[row][column]
• C++ style constructors
- vec3 a =vec3(1.0, 2.0, 3.0)
- vec2 b = vec2(a)

No Pointers
• There are no pointers in GLSL
• We can use C structs which
can be copied back from functions
• Because matrices and vectors are basic
types they can be passed into and output
from GLSL functions, e.g.
mat3 func(mat3 a)
• variables passed by copying

Qualifiers
• GLSL has many of the same qualifiers such as
const as C/C++
• Need others due to the nature of the execution
model
• Variables can change
- Once per primitive
- Once per vertex
- Once per fragment
- At any time in the application
• Vertex attributes are interpolated by the
rasterizer into fragment attributes

Attribute Qualifier
• Attribute-qualified variables can change at
most once per vertex
• There are a few built in variables such as
gl_Position but most have been deprecated
• User defined
-in float temperature
-in vec3 velocity
- WebGL 1.0 uses attribute and varying
qualifiers to get to and from shaders

Uniform Qualified
• Variables that are constant for an entire
primitive
• Can be changed in application and sent to
shaders
• Cannot be changed in shader
• Used to pass information to shader such
as the time or a bounding box of a
primitive or transformation matrices

Varying Qualified
• Variables that are passed from vertex shader
to fragment shader
• Automatically interpolated by the rasterizer
• With WebGL 1.0, GLSL uses the varying
qualifier in both shaders
varying vec4 color;
• More recent versions of WebGL use out in
vertex shader and in in the fragment shader
out vec4 color; //vertex shader
in vec4 color; // fragment shader

Our Naming Convention
• attributes passed to vertex shader have names
beginning with a (aPosition, aColor) in both the
application and the shader
- Note that these can have different values in
vertex shader and fragment shader with the same
name because of interpolation by the rasterizer
• Variable variables begin with v (vColor) are defined in
the vertex shader
• Variable variables begin with f (fColor) are defined in the
fragment shader
• Uniform variables begin with u (uColor) and can have the
same name in application and shaders

Example: Vertex Shader
in vec4 aColor, aPosition;
out vec4 vColor;
void main()
gl_Position = aPosition;
vColor = aColor;

Corresponding Fragment
Shader
precision mediump float;
in vec4 vColor;
out vec4 fColor
void main()
fColor = vColor;

Sending Colors from
Application
var cBuffer = gl.createBuffer();
gl.bindBuffer( gl.ARRAY_BUFFER, cBuffer );
gl.bufferData( gl.ARRAY_BUFFER, flatten(colors),
gl.STATIC_DRAW );
var aColor = gl.getAttribLocation( program, ”aColor" );
gl.vertexAttribPointer( aColor, 3, gl.FLOAT, false, 0, 0 );
gl.enableVertexAttribArray( aColor );

Sending a Uniform Variable
// in application
vec4 uColor = vec4(1.0, 0.0, 0.0, 1.0);
colorLoc = gl.getUniformLocation( program, ”color" );
gl.uniform4f( colorLoc, uColor);
// in fragment shader (similar in vertex shader)
uniform vec4 uColor;
out vec4 fColor;
void main()
gl_FragColor = uColor;
} finer: Interactive Computer Graphics 7E © Addison-Wesley 2015 59

Operators and Functions
• Standard C functions
- Trigonometric
- Arithmetic
- Normalize, reflect, length
• Overloading of vector and matrix types
mat4 a;
vec4 b, c, d;
c = b*a; // a column vector stored as a 1d array
d = a*b; // a row vector stored as a 1d array

Swizzling and Selection
• Can refer to array elements by element
using [] or selection (.) operator with
- x, y, z, w
- r, g, b, a
- s, t, p, q
-a[2], a.b, a.z, a.p are the same
• Swizzling operator lets us manipulate
components
vec4 a, b;
a.yz = vec2(1.0, 2.0, 3.0, 4.0);
b = a.yxzw;

Programming with WebGL
Part 4: Color and Attributes
Ed Angel
Professor of Emeritus of Computer Science
University of New Mexico

Objectives
• Expanding primitive set
• Adding color
• Vertex attributes

WebGLPrimitives
GL_POINTS
GL_LINE_STRIP
GL_LINES
GL_LINE_LOOP
GL_TRIANGLES
GL_TRIANGLE_FAN
GL_TRIANGLE_STRIP

Polygon Issues
• WebGL will only display triangles
- Simple: edges cannot cross
- Convex: All points on line segment between two points in a
polygon are also in the polygon
- Flat: all vertices are in the same plane
• Application program must tessellate a polygon into
triangles (triangulation)
• OpenGL 4.1 contains a tessellator but not WebGL
nonconvex polygon
nonsimple polygon

Polygon Testing
• Conceptually simple to test for simplicity
and convexity
• Time consuming
• Earlier versions assumed both and left
testing to the application
• Present version only renders triangles
• Need algorithm to triangulate an arbitrary
polygon

Good and Bad Triangles
• Long thin triangles render badly
• Equilateral triangles render well
• Maximize minimum angle
• Delaunay triangulation for unstructured points

Triangularization
• Convex polygon
• Start with abc, remove b, then acd, ….

Non-convex (concave)

Recursive Division
• Find leftmost vertex and split

Attributes
• Attributes determine the appearance of objects
- Color (points, lines, polygons)
- Size and width (points, lines)
- Stipple pattern (lines, polygons)
- Polygon mode
• Display as filled: solid color or shaded
• Display edges
• Display vertices
• Only a few (gl_PointSize) are supported by
WebGL functions

RGB color
• Each color component is stored separately in
the frame buffer
• Usually 8 bits per component in buffer
• Color values can range from 0.0 (none) to 1.0
(all) using floats or over the range from 0 to 255
using unsigned bytes

Indexed Color
• Colors are indices into tables of RGB values
• Requires less memory
- indices usually 8 bits
- not as important now
• Memory inexpensive
• Need more colors for shading

Smooth Color
• Default is smooth shading
- Rasterizer interpolates vertex colors across
visible polygons
• Alternative is flat shading
- Color of first vertex
determines fill color
- Handle in shader

Setting Colors
• Colors are ultimately set in the fragment
shader but can be determined in either
shader or in the application
• Application color: pass to vertex shader
as a uniform variable or as a vertex
attribute
• Vertex shader color: pass to fragment
shader as in variable
• Fragment color: can alter via shader code

Programming with WebGL
Part 5: More GLSL
Ed Angel
Professor Emeritus of Computer Science
University of New Mexico

Objectives
• Coupling shaders to applications
- Reading
- Compiling
- Linking
• Vertex Attributes
• Setting up uniform variables
• Example applications

Linking Shaders with Application
• Read shaders
• Compile shaders
• Create a program object
• Link everything together
• Link variables in application with variables
in shaders
- Vertex attributes
- Uniform variables

Program Object
• Container for shaders
- Can contain multiple shaders
- Other GLSL functions
var program = gl.createProgram();
gl.attachShader( program, vertShdr );
gl.attachShader( program, fragShdr );
gl.linkProgram( program );

Reading a Shader
• Shaders are added to the program object
and compiled
• Usual method of passing a shader is as a
null-terminated string using the function
• gl.shaderSource( fragShdr, fragElem.text );
• If shader is in HTML file, we can get it into
application by getElementById method
• If the shader is in a file, we can write a
reader to convert the file to a string

Adding a Vertex Shader
var vertShdr;
var vertElem =
document.getElementById( vertexShaderId );
vertShdr = gl.createShader( gl.VERTEX_SHADER );
gl.shaderSource( vertShdr, vertElem.text );
gl.compileShader( vertShdr );
// after program object created
gl.attachShader( program, vertShdr );

Shader Reader
• Following code may be a security issue
with some browsers if you try to run it
locally
- Cross Origin Request
function getShader(gl, shaderName, type) {
var shader = gl.createShader(type);
shaderScript = loadFileAJAX(shaderName);
if (!shaderScript) {
alert("Could not find shader source:
"+shaderName);

Precision Declaration
• In GLSL for WebGL we must specify
desired precision in fragment shaders
- artifact inherited from OpenGL ES
- ES must run on very simple embedded devices
that may not support 32-bit floating point
- All implementations must support mediump
- No default for float in fragment shader
• Can use preprocessor directives (#ifdef)
to check if highp supported and, if not,
default to mediump

Pass Through Fragment Shader
#ifdef GL_FRAGMENT_SHADER_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
in vec4 vColor;
out vect fColor;
void main()
fColor = vcolor;

Programming with WebGL
Part 6: Three Dimensions
Ed Angel
Professor Emeritus of Computer Science
University of New Mexico

Objectives
• Develop a more sophisticated three-
dimensional example
- Sierpinski gasket: a fractal
• Introduce hidden-surface removal

Three-dimensional Applications
• In WebGL, two-dimensional applications
are a special case of three-dimensional
graphics
• Going to 3D
- Not much changes
- Use vec3, gl.uniform3f
- Have to worry about the order in which
primitives are rendered or use hidden-surface
removal

Sierpinski Gasket (2D)
• Start with a triangle
• Connect bisectors of sides and remove central
triangle
• Repeat

Example
• Five subdivisions

The gasket as a fractal
• Consider the filled area (black) and the
perimeter (the length of all the lines around
the filled triangles)
• As we continue subdividing
- the area goes to zero
- but the perimeter goes to infinity
• This is not an ordinary geometric object
- It is neither two- nor three-dimensional
• It is a fractal (fractional dimension) object

Gasket Program
• HTML file
- Same as in other examples
- Pass through vertex shader
- Fragment shader sets color
- Read in JS file

Gasket Program
var points = [];
var numTimesToSubdivide = 5;
/* initial triangle */
var vertices = [
vec2( -1, -1 ),
vec2( 0, 1 ),
vec2( 1, -1 )
];
divideTriangle( vertices[0],vertices[1],
vertices[2], NumTimesToSubdivide);

Draw one triangle
/* display one triangle */
function triangle( a, b, c ){
points.push( a, b, c );

Triangle Subdivision
function divideTriangle( a, b, c, count ){
// check for end of recursion
if ( count === 0 ) {
triangle( a, b, c );
else {
//bisect the sides
var ab = mix( a, b, 0.5 );
var ac = mix( a, c, 0.5 );
var bc = mix( b, c, 0.5 );
--count;
// three new triangles
divideTriangle( a, ab, ac, count-1 );
divideTriangle( c, ac, bc, count-1 );
divideTriangle( b, bc, ab, count-1 );

init()
var program = initShaders( gl,
"vertex-shader", "fragment-shader" );
gl.useProgram( program );
var bufferId = gl.createBuffer();
gl.bindBuffer( gl.ARRAY_BUFFER, bufferId )
gl.bufferData( gl.ARRAY_BUFFER,
flatten(points), gl.STATIC_DRAW );
var vPosition = gl.getAttribLocation(
program, "vPosition" );
gl.vertexAttribPointer( vPosition, 2, gl.FLOAT,
false, 0, 0 );
gl.enableVertexAttribArray( vPosition );
render();

Render Function
function render(){
gl.clear( gl.COLOR_BUFFER_BIT );
gl.drawArrays( gl.TRIANGLES, 0, points.length );

Programming with WebGL
Part 6: Three Dimensions
Ed Angel
Professor Emeritus of Computer Science
University of New Mexico

Moving to 3D
We can easily make the program three-
dimensional by using three dimensional points
and starting with a tetrahedron
var vertices = [
vec3( 0.0000, 0.0000, -1.0000 ),
vec3( 0.0000, 0.9428, 0.3333 ),
vec3( -0.8165, -0.4714, 0.3333 ),
vec3( 0.8165, -0.4714, 0.3333 )
];
subdivide each face

3D Gasket
• We can subdivide each of the four faces
• Appears as if we remove a solid
tetrahedron from the center leaving four
smaller tetrahedra
• Code almost identical to 2D example

Almost Correct
• Because the triangles are drawn in the order
they are specified in the program, the front
triangles are not always rendered in front of
triangles behind them
get this
want this

Hidden-Surface Removal
• We want to see only those surfaces in front of
other surfaces
• OpenGL uses a hidden-surface method called
the z-buffer algorithm that saves depth
information as objects are rendered so that only
the front objects appear in the image

Using the z-buffer algorithm
• The algorithm uses an extra buffer, the z-buffer, to store
depth information as geometry travels down the pipeline
• Depth buffer is required to be available in WebGL
• It must be
- Enabled
•gl.enable(gl.DEPTH_TEST)
- Cleared in for each render
•gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

Surface vs Volume Subdvision
• In our example, we divided the surface of
each face
• We could also divide the volume using the
same midpoints
• The midpoints define four smaller
tetrahedrons, one for each vertex
• Keeping only these tetrahedrons removes
a volume in the middle
• See text for code

Volume SubdivisionInteractive Computer Graphics
Professor: Marco Schaerf
Slides taken from professor, Steve Marschner, Cornell CS4620/5620 Fall 2014 course • Lecture 1

Computer graphics: The study
of creating, manipulating, and using
visual images in the computer.

Or, to paraphrase Ken Perlin...
Computer graphics: What you
need to show other people your dreams.

Graphics Applications
• Entertainment
| – film | production |     |     |     |     |     |
| ------ | ---------- | --- | --- | --- | --- | --- |
| – film | effects    |     |     |     |     |     |
– games
| • Science | and | engineering |     |     |     |     |
| --------- | --- | ----------- | --- | --- | --- | --- |
– computer-aided design
| – visualization |             | (scientific, | information) |     |     |     |
| --------------- | ----------- | ------------ | ------------ | --- | --- | --- |
| • Virtual       | Prototyping |              |              |     |     |     |
| • Cultural      | Heritage    |              |              |     |     |     |
| • Training      | &           | Simulation   |              |     |     |     |
• GraphicArts, FineArt
|     |     |     |     | Wednesday,August27, | 14  | 4   |
| --- | --- | --- | --- | ------------------- | --- | --- |

Graphics Applications
• Entertainment
| – film | production |     |     |     |     |     |
| ------ | ---------- | --- | --- | --- | --- | --- |
| – film | effects    |     |     |     |     |     |
– games
| • Science | and | engineering |     |     |     |     |
| --------- | --- | ----------- | --- | --- | --- | --- |
– computer-aided design
| – visualization |             | (scientific, | information) |                     |     |     |
| --------------- | ----------- | ------------ | ------------ | ------------------- | --- | --- |
| • Virtual       | Prototyping |              |              |                     |     |     |
| • Cultural      | Heritage    |              |              |                     |     |     |
| • Training      | &           | Simulation   |              |                     |     |     |
| • GraphicArts,  | FineArt     |              |              |                     |     |     |
|                 |             |              |              | Wednesday,August27, | 14  | 5   |

Pixar—Toy Story


Pixar—The Blue Umbrella (2013)

The Hobbit: An Unexpected Journey (New Line Cinema, 2012)—visual effects by Weta Digital


Crytek—Crysis 3 (2013)

Quantic Dream—Two Souls (2013) screenshot: videogamer.com

| Unreal | 5 engine: | youtube | link |
| ------ | --------- | ------- | ---- |

Hyper-realism

VFX example

| Diffusion | models (Deep Learning applied | to graphics! |
| --------- | ----------------------------- | ------------ |

| Diffusion | models (Deep Learning applied | to graphics! |
| --------- | ----------------------------- | ------------ |

Graphics Applications
• Entertainment
– film production
– film effects
– games
• Science and engineering
– computer-aided design
– visualization (scientific, information)
• Virtual Prototyping
• Cultural Heritage
• Training & Simulation
U. of Utah—Alpha 1
• Graphic Arts, Fine Art

Simulated
deformation of
citrate synthase
during substrate
binding
Kalju Kahn, UCSB


Graphics Applications
• Entertainment
– film production
– film effects
– games
• Science and engineering
– computer-aided design
– scientific visualization
• Virtual Prototyping
• Cultural Heritage
• Training & Simulation
• Graphic Arts, Fine Art

Autodesk 360 Cloud Render

Autodesk 360 Cloud Render

Autodesk 360 Cloud Render

IKEA—rendered catalog image (2012)

[Walter et al. 2005] model: University of Bristol

Digital
Michelangelo
Project
Marc Levoy, Stanford

Digital
Michelangelo
Project
Marc Levoy, Stanford

Graphics Applications
• Entertainment
– film production S
—
– film effects
– games A
/
• Science and engineering N
– computer-aided design
– scientific visualization
• Virtual Prototyping
• Cultural Heritage E
—I
• Training & Simulation
• Graphic Arts, Fine Art e

Graphics Applications
• Entertainment
– film production
:
– film effects
.
– games s
• Science and engineering
– computer-aided design
– scientific visualization I
• Virtual Prototyping
• Cultural Heritage
• Training & Simulation
• Graphic Arts, Fine Arts

Graphics Applications
• Entertainment
– film production
– film effects
– games
• Science and engineering
– computer-aided design
– scientific visualization
• Virtual Prototyping
• Cultural Heritage
• Training & Simulation Computer aided sculptures
Ergun Akleman
• Graphic Arts, Fine Arts


W h a t is graphics about?

3 D Modeling
• representing 3D shapes
• polygons, curved surfaces, …
• procedural modeling e
.l
Headus—Cysurf k
.l

3 D Modeling
• representing 3D shapes
N U M E R I C A L
O PTIMIZATIO N
• polygons, curved surfaces, …
• procedural modeling e
.l
DIFFERENTIAL
GEOMETRY
G R A M M A R S i
Headus—Cysurf k
.l

3 D Rendering
• 2D views of 3D geometry
• projection and perspective
• removing hidden surfaces s
• lighting simulation

3 D Rendering
• 2D views of 3D geometry
INTEG R AL EQUATIONS
• projection and perspective
• Removing hidden surfaces s
• Lighting simulation

G c
P B
l ,
l a
n a
r B
C a

Animation

Animation
• keyframe animation
• physical simulation
DIFFERENTIAL
EQUATIONS
Avengers (2012)
Pixar

Images
• 2D imaging
– compositing and layering
– digital filtering
– color transformations
• 2D drawing
– illustration, drafting
– text, GUIs

Images
• 2D imaging
– compositing and layering
– digital filtering
S IG NAL PROCESSING
– color transformations
• 2D drawing
– illustration, drafting
– text, GUIs
POLYNOMIALS

U s e r Interaction
• 2D graphical user interfaces
• 3D modeling interfaces
• virtual reality
—

U s e r Interaction
• 2D graphical user interfaces
SPHERICAL GEOMETRY
• 3D modeling interfaces
• virtual reality
—
PROJECTIVE n
GEOMETRY n

Graphics Hardware

Computer graphics:
Mathematics made visible.

Introductions…

Translucent materials
Diffuse “milk”

Translucent materials
Diffuse “milk” Skim milk

Translucent materials
| Diffuse “milk” | Skim milk | Whole milk |
| -------------- | --------- | ---------- |

Digital characters
Gollum from The Lord of the Rings: hair and skin
are two major rendering challenges in film effects

Rendering hair
a = 1.0

Rendering hair
a = 1.2

Rendering hair
a = 1.5

Modeling knit cloth
[Yuksel et al. 2012]
S c Mesh
Re re

[Yuksel et al. 2012]

| H   | i g h | - quality woven cloth appearance |
| --- | ----- | -------------------------------- |
[Zhao et al. 2012]

Course Overview

| In  | this | Interactive Computer Graphics course, |     |
| --- | ---- | ------------------------------------- | --- |
• You will:
| –   | explore fundamental ideas |       |                    |
| --- | ------------------------- | ----- | ------------------ |
| –   | learn                     | basic | math essential to  |
graphics
| –   | implement key algorithms  |     |     |
| --- | ------------------------- | --- | --- |
| –   | write cool programs       |     |     |
| –   | learn the basics of WebGL |     |     |
• You will not:
| –   | write very big programs |     |     |
| --- | ----------------------- | --- | --- |

Topics
• (a bit of) Images, image processing, color
science
• (a bit of)Geometric transformations
• The WebGL graphics pipeline for 3D
rendering
• Animation
• Ray tracing

Prerequisites
• Programming
• In theory: knowledge of JavaScript and GLSL
language
• In practice:
ability to read, write, and debug small programs
in any language, and understanding of very basic data
structures
– no serious software design required
• Mathematics
– vector geometry (dot/cross products, etc.)
– linear algebra (just basic matrices in 2-4D)
– basic calculus
– graphics is a good place to pick up some, but not all, of this

| W   | o r k | l o a | d   |     |
| --- | ----- | ----- | --- | --- |
Project-based course
| –   | Some (4-7) projects during                 |     |            | the course, with a  |
| --- | ------------------------------------------ | --- | ---------- | ------------------- |
|     | possible                                   |     | associated | score               |
| –   | One finalproject with score                |     |            |                     |
| –   | Some detailswillbe definedduringthe course |     |            |                     |

Textbook
Shirley & Marschner
Fundamentals of
Computer Graphics
| 4th  | edition       |          |
| ---- | ------------- | -------- |
| Only | few, selected | chapters |

| Youtube | additional | resource |
| ------- | ---------- | -------- |
• A good part of the course follows the teachings of Cem Yuksel Youtube course

M o r e books
Steven Gortler
Foundations of Computer Graphics
first edition
OpenGL Programming Guide
(a.k.a. the "Red Book")
Older version available online:
http://www.opengl.org/documentation/red_book/
G LSL Shading Language
(a.k.a. the "Orange Book")

Course mechanics
Google Classroom:
https://classroom.google.com/c/MjE4ODM0MjY0MTVa?cjc=5ees4sip
Schedule, handouts, etc. all on the web pageMath Background
• Vectors
• Matrices

Math Background - Vectors
Vectors
• 1D: [x]
• 2D: [x,y]
• 3D; [x,y,z]
• 4D: [x,y,z,w]
• ND: [x,y,z,w,…]

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors
| • In order | to find where    | the point | is,  |
| ---------- | ---------------- | --------- | ---- |
| something  | still missing... |           |      |

Math Background - Vectors
| • In order | to find where    | the point | is,  |
| ---------- | ---------------- | --------- | ---- |
| something  | still missing... |           |      |
• A coordinate system!

Math Background - Vectors
| • In order     | to find where    |     | the point | is,  |
| -------------- | ---------------- | --- | --------- | ---- |
| something      | still missing... |     |           |      |
| • A coordinate | system!          |     |           |      |
•
| ...which   | means     | knowing | the axes   |     |
| ---------- | --------- | ------- | ---------- | --- |
| directions | and where |         | the origin | is! |

Math Background - Vectors

| Math Background - | Vectors              |     |           |     |
| ----------------- | -------------------- | --- | --------- | --- |
| • It is           | an extremely         |     | important |     |
| concept           | in Computer Graphics |     |           |     |
•
| Two                  | vectors  | referred          | to      | two      |
| -------------------- | -------- | ----------------- | ------- | -------- |
| different coordinate |          |                   | systems |          |
| cannot               | interact |                   | without | applying |
| some                 | sort     | of transformation |         |          |

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

Math Background - Vectors

| Math Background - Vectors |                   |             |     |
| ------------------------- | ----------------- | ----------- | --- |
| • Useful                  | operation         | to check if | two |
| vectors                   | are perpendicular |             |     |

| Math Background - Vectors |           |               |                     |          |      |
| ------------------------- | --------- | ------------- | ------------------- | -------- | ---- |
| • Useful                  | operation |               | to                  | check if | two  |
| vectors                   | are       | perpendicular |                     |          |      |
| • Be aware: the           |           | results       |                     | can be   | zero |
| even                      | if they   | are           | not perpendicular,  |          |      |
| but one                   | of        | them          | is a zero           | vector!  |      |

Math Background - Vectors

| Math Background - Vectors |             |               |        |         |
| ------------------------- | ----------- | ------------- | ------ | ------- |
| • Cross product           |             | of two        | vector | (in 3D  |
| space)                    | is a vector | perpendicular |        | to      |
both

| Math Background - Vectors |             |     |               |        |         |     |
| ------------------------- | ----------- | --- | ------------- | ------ | ------- | --- |
| • Cross product           |             | of  | two           | vector | (in 3D  |     |
| space)                    | is a vector |     | perpendicular |        |         | to  |
both
| • In 2D space |        | instead       |     | I will get | the     |     |
| ------------- | ------ | ------------- | --- | ---------- | ------- | --- |
| area          | of the | parallelogram |     |            | defined |     |
| by the        | two    | vectors!      |     |            |         |     |

Math Background - Vectors
| • The cross     | product | of two  | parallel  |
| --------------- | ------- | ------- | --------- |
| vectors is      | zero    |         |           |
| • This property | can     | be used | to        |
check parallelism

Math Background - Vectors
| • A minus sign |              | of one  | of the     | two |
| -------------- | ------------ | ------- | ---------- | --- |
| vectors        | will results |         | in a cross |     |
| product        | with         | flipped | direction  |     |

Math Background - Vectors
| • A minus sign |              | of one  | of the     | two |
| -------------- | ------------ | ------- | ---------- | --- |
| vectors        | will results |         | in a cross |     |
| product        | with         | flipped | direction  |     |

Math Background - Matrices
| • Matrices are   |          | heavily |                    | used in CG  |     |
| ---------------- | -------- | ------- | ------------------ | ----------- | --- |
| for transforming |          |         | entities, e.g. for |             |     |
| changing         | a vector |         | coordinate         |             |     |
system
•
| Most of                 | the | time they |     | will be  | 2D  |
| ----------------------- | --- | --------- | --- | -------- | --- |
| (2x2), 3D(3x3), 4D(4x4) |     |           |     | matrices |     |

Math Background - Matrices
| • The product   |          | of a Matrix by         |                | a        |
| --------------- | -------- | ---------------------- | -------------- | -------- |
| Vector is       | a Vector |                        |                |          |
| • This actually |          | transform              | the            | vector,  |
| e.g. it         | can be   | used                   | to express the |          |
| vector          | into     | a different coordinate |                |          |
system!

Math Background - Matrices
| • The product |     | of two | matrices | is not commutative |     |     |
| ------------- | --- | ------ | -------- | ------------------ | --- | --- |
•
| This is                           | especially  |     | important       | in CG because  |             | we will  |
| --------------------------------- | ----------- | --- | --------------- | -------------- | ----------- | -------- |
| often                             | concatenate |     | transformations |                | by applying |          |
| several matrices multiplication – |             |     |                 | and the order  |             |          |
matters!

Math Background - Vectors
| • The cross     | product | of two  | parallel  |
| --------------- | ------- | ------- | --------- |
| vectors is      | zero    |         |           |
| • This property | can     | be used | to        |
check parallelismRaster Images
Outline:
•
| What            | is a raster | image?     |             |
| --------------- | ----------- | ---------- | ----------- |
| • Raster images |             | vs vector  | images      |
| • Raster images |             | properties | and formats |
• Alpha blending, etc

Raster Images
•
| Raster image: |     | "a raster | graphic | (image) | represents | a two- |
| ------------- | --- | --------- | ------- | ------- | ---------- | ------ |
dimensional picture as a rectangular matrix or grid of pixels,
| viewable | via a | computer | display, | paper, or | other | display |
| -------- | ----- | -------- | -------- | --------- | ----- | ------- |
medium."

Raster Images
•
| Raster image: bunch |          |        | of pixels | in  |
| ------------------- | -------- | ------ | --------- | --- |
| a matrix            | form     |        |           |     |
| • Is this           | a raster | image? |           |     |

Raster Images
• Is this a raster
image? No!

Raster Images
| • This is      | the corresponding |         | raster   | image |
| -------------- | ----------------- | ------- | -------- | ----- |
| • Pixels means |                   | picture | elements |       |

Raster Images
| • "A      | pixel | is not a           | little square" |       |
| --------- | ----- | ------------------ | -------------- | ----- |
| • Each    | pixel | is mathematically  |                | a     |
| "point"   |       | with corresponding |                |       |
| color     |       | values             |                |       |
| • But it  | is    | actually           | displayed      | as a  |
| rectangle |       | on monitors!       |                |       |

Colors

Raster Images
• Actual perceived colors are just hallucinations of our minds starting from excited eyes
cones

Raster Images
•
| Each | cone | is sensible to | a portion | of visible spectrum |
| ---- | ---- | -------------- | --------- | ------------------- |

Raster Images
•
| For this | very good | reason | we work | with RGB images! |
| -------- | --------- | ------ | ------- | ---------------- |

Raster Images
•
| For this | very good | reason | we work | with RGB images! |
| -------- | --------- | ------ | ------- | ---------------- |

Raster Images
| • It is | basically | a 3D coordinate | system! |
| ------- | --------- | --------------- | ------- |

Raster Images
| • Sun is | brighter | than | monitor, obviously! |
| -------- | -------- | ---- | ------------------- |

Raster Images
| • HDR takes | into consideration | also intensity | values |
| ----------- | ------------------ | -------------- | ------ |

Raster Images
• 8 bits sufficient for most of the usages, as people cannot perceive less than 1/255 difference

Raster Images
• 8 bits sufficient for most of the usages, as people cannot perceive less than 1/255 difference
• In some cases 16 bits are more convenient (e.g. modifying images)

Raster Images
• In Computer Graphics we will often work with 32-bit floats, and only at the end we will
| convert | to the | corrsponding | 8 bits | value |
| ------- | ------ | ------------ | ------ | ----- |

Raster Images formats
| • The interleaved | storage | is more | common |
| ----------------- | ------- | ------- | ------ |

Raster Images formats
| • The interleaved |     | storage | is more | common |     |
| ----------------- | --- | ------- | ------- | ------ | --- |
•
| In some | cases | we see | separate channels |     | format |
| ------- | ----- | ------ | ----------------- | --- | ------ |

Raster Images formats
| • The interleaved |       | storage | is more           | common |        |
| ----------------- | ----- | ------- | ----------------- | ------ | ------ |
| • In some         | cases | we see  | separate channels |        | format |
•
Even when displayed as matrix, most of the time they are 1D array in memory!

Raster Images formats
| • Simplest | image | formats |
| ---------- | ----- | ------- |
•
Not compressed

Raster Images formats
• Color table trick to compress the data (with loss of information due to quantization)

Raster Images formats
| • Very popular | format | nowadays |
| -------------- | ------ | -------- |
•
It can store multiple images, a property exploited to show small animations

Raster Images formats
• Lossy compression! Cannot recover the original image data :-(
•
| It can | produce | a way | smaller | file :-) |
| ------ | ------- | ----- | ------- | -------- |

Image formats examples
| • Very good | quality | :-) but 146kb :-( |
| ----------- | ------- | ----------------- |

|             |         |          | Image   | formats | examples |
| ----------- | ------- | -------- | ------- | ------- | -------- |
| • Very good | quality | :-) only | 5kb :-) |         |          |

|          |         |               | Image       | formats | examples |
| -------- | ------- | ------------- | ----------- | ------- | -------- |
| • Baaaad | quality | :-) 17kb file | size, worse | than    | PNG :-o  |

|          |         |              | Image     | formats    | examples |
| -------- | ------- | ------------ | --------- | ---------- | -------- |
| • Better | quality | :-) but file | size keep | increasing | :-o      |

| Image | formats | examples |
| ----- | ------- | -------- |
• Some loss of quality due to quantization :-( but only 3kb file :-)

PNG vs JPG
• Right file (jpg) shows a sensible loss of quality but reduced file size

PNG vs JPG
• With better quality setting the loss is almost unoticeable, but file size is half w.r.t. PNG!

PNG vs JPG
• With better quality setting the loss is almost unoticeable, but file size is half w.r.t. PNG!

PNG vs JPG
• WMoral of the story: there is no strictly better format :-)
| • Concept explained | into a brilliant | xkcd comic |
| ------------------- | ---------------- | ---------- |

• WMoral of the story: there is no strictly better format :-)
•
| Concept explained | into a brilliant | xkcd comic |
| ----------------- | ---------------- | ---------- |

Color quantization

HDR file format
• Very useful in film production
• Along with RGB, it can store a lot of more channels: diffuse, specular, alpha, etc
• It turns out that compression algorithms work way better at 8bits than 32 bits

Pixels order
• Swizzled order: useful to quickly
access neighbour pixels
• Used inside GPU

Gamma: Ɣ
• What is the middle 0.5 value?

Gamma: Ɣ
• Is this one?

Gamma: Ɣ
• Is this one? No!

Gamma: Ɣ
• Is this one? Yes!

Gamma: Ɣ
• It seems reasonable to uniformly divide the 0-1 range, given the chosen bits precision

Gamma: Ɣ
• It would make much more sense to space intensity values like this

Gamma: Ɣ
• This non-linear spacing is actually implemented inside the monitor

Gamma: Ɣ
• Here is why 0.5 intensity value corresponds to way darker image than expected!

Gamma: Ɣ
• Exponential function of gamma!

Gamma: Ɣ
• If I desire a particular intensity value, I need to send a gamma-corrected value!

Gamma: Ɣ
• The typical value of 2.2 comes from the monitors implementing the sRGB standard (most of
them)
• In the past different monitors (CRT!) had different gamma values
• Some recent smartphones do not use sRGB and thus can have different gamma values

Displays

Cameras

Cameras
• LCD sensors pixels are much harder to produce and stock into the sensor
• Human vision is much more sensible at green than at at red or blue

Alpha Blending

Alpha Blending

Alpha Blending
• 32bits per pixel when using 8bits precision
• Usual storage (interleaved or per channel) as RGB

Alpha Blending

Alpha Blending

Alpha Blending

Alpha Blending

Additive Blending

Multiplicative Blending

Screen Blending

Many blending modesTransformations

Transformations
| • How | do I make | this scene | in  |
| ----- | --------- | ---------- | --- |
reality?
| • How | do I make | this scene | in  |
| ----- | --------- | ---------- | --- |
Computer Graphics?

Affine transformations
| • Affine | transformations | preserve | lines |
| -------- | --------------- | -------- | ----- |
| and      | the parallelism | of lines |       |

Affine transformations
| • Affine | transformations | preserve | lines |
| -------- | --------------- | -------- | ----- |
| and      | the parallelism | of lines |       |

Affine transformations
| • Affine | transformations | preserve | lines |
| -------- | --------------- | -------- | ----- |
| and      | the parallelism | of lines |       |

Affine transformations
| • Affine | transformations | preserve | lines |
| -------- | --------------- | -------- | ----- |
| and      | the parallelism | of lines |       |
• Skew is a combination of rotation
and scale

Affine transformations
| • Affine | transformations | preserve | lines |
| -------- | --------------- | -------- | ----- |
| and      | the parallelism | of lines |       |
• Rotation and Scale are linear
transformations

Affine transformations
| • Affine | transformations | preserve | lines |
| -------- | --------------- | -------- | ----- |
| and      | the parallelism | of lines |       |
• Rotation and Scale are linear
transformations
• Translation is not a linear
transformation
• Proof: if linear, T(u+v) = T(u)+T(v)

Affine transformations
• Affine transformations preserve lines
and the parallelism of lines
• Rotation and Scale are linear
transformations
• Translation is not a linear
transformation
• Proof: if linear, T(u+v) = T(u)+T(v)
• Proof 2°: zero vector must be
mapped to zero vector by the
transformation

Affine transformations
| • Affine | transformations | preserve | lines |
| -------- | --------------- | -------- | ----- |
| and      | the parallelism | of lines |       |
• Rotation and Scale are linear
transformations
• Translation is not a linear
transformation
• Proof: if linear, T(u+v) = T(u)+T(v)
• Proof 2°: zero vector must be
mapped to zero vector by the
transformation
•
| Still, Translation is |     | an affine  |     |
| --------------------- | --- | ---------- | --- |
transformation

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations
• This represent the rotation of the Px
component

2D affine transformations

2D affine transformations
• If the rotation is clockwise, then use
–tetha in the equation
• The formula can be written as:
p' = Rp

2D affine transformations
• All rotation matrices are orthogonal,
but not all orthogonal matrices
are rotation matrices ;-)

2D affine transformations

2D affine transformations
• Scale transformation can be
represented in matrix form as well
• p' = Sp

2D affine transformations
• Scale transformation can be
represented in matrix form as well
• p' = Sp

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations

2D affine transformations
• SVD actually generalizes over ANY
Matrix (even rectangular ones!)

2D affine transformations
• It is nice to collapse a pipeline of
transformations into a single one :-)

2D affine transformations
• It is nice to collapse a pipeline of
transformations into a single one :-)
• This cannot be applied to translation :-(

2D affine transformations
• It is nice to collapse a pipeline of
transformations into a single one :-)
• This cannot be applied to translation :-(
• ...can't it? :-)

Rotation & Translation
• This happens when I apply a rotation
matrix

Rotation & Translation
• What if I want to rotate the square
w.r.t. his centre?

2D affine transformations

Homogeneous coordinates

Homogeneous coordinates

Homogeneous coordinates
• The trick consists in adding an extra
dimension with value equal 1, so that
| now the     | addition operation          | can be  |
| ----------- | --------------------------- | ------- |
| represented | as a matrix multiplication! |         |

Homogeneous coordinates
• The trick consists in adding an extra
dimension with value equal 1, so that
| now the | addition operation |     | can be  |
| ------- | ------------------ | --- | ------- |
represented as a matrix multiplication!
• An extra row on the
| matrix | guarantees | that the | output of  |
| ------ | ---------- | -------- | ---------- |
this operation is still a vector in
homogeneous coordinates

Homogeneous coordinates
• The trick consists in adding an extra
dimension with value equal 1, so that
| now the | addition operation |     | can be  |
| ------- | ------------------ | --- | ------- |
represented as a matrix multiplication!
• An extra row on the
| matrix | guarantees | that the | output of  |
| ------ | ---------- | -------- | ---------- |
this operation is still a vector in
homogeneous coordinates
• Moreover, we love square matrices :-)

Homogeneous coordinates
• It seems I made calculations more
complicated, but...

Homogeneous coordinates
• It seems I made calculations more
complicated, but...
• ...but now I can represent any
transformation with the matrix
multiplication operation! :-))

Homogeneous coordinates
• The components e,f represents the
final translation part of this
transformation
• The components a,b,c,d represents
the rotation and scale part

Transformations
• Now we understand how we
put objects in that scene!

Transformations
• Transformations can
be thought as changing this
vector, or...

Transformations
• Transformations can
be thought as changing this
vector, or...

Transformations
• ...or as the tranformation
needed to represent a vector
into a new coordinates frame!

Transformations
• ...or as the tranformation
needed to represent a vector
into a new coordinates frame!

Transformations

Transformations preserving directions
• What if I need to preserve
direction?

Transformations

Transformations3D Transformations
| • 3D transformations | are       | a   |
| -------------------- | --------- | --- |
| straightforward      | extension | of  |
the 2D case
| • 4x4 matrices | with i,k,l  |        |
| -------------- | ----------- | ------ |
| components     | responsible | of the |
| translation    | part        |        |

Scale in 3D
• 3D transformations are a
straightforward extension of
the 2D case

Translation in 3D
• 3D transformations are a
straightforward extension of
the 2D case

Rotation in 2D
• In 2D there is only one possible
rotation, which means there is
only one possible rotation plane
and only one possible rotation
axis

Rotation in 3D
• In 3D you can rotate around
| the three | coordinate system  |     |
| --------- | ------------------ | --- |
axes
• But you can actually
| rotate | around any | axis, and this  |
| ------ | ---------- | --------------- |
rotation can be
| always | decomposed in three  |     |
| ------ | -------------------- | --- |
rotations

Rotation in 3D
• In 3D you can rotate around
| the three | coordinate system axes |     |
| --------- | ---------------------- | --- |
• But you can actually
| rotate | around any | axis, and this  |
| ------ | ---------- | --------------- |
rotation can be
| always | decomposed in three  |     |
| ------ | -------------------- | --- |
rotations
• More info on rotation
decomposition here:
https://nghiaho.com/?page_id=846

Rotation in 3D
• In each of those "elementary"
rotations one row is taken from
the identity matrix
• This corresponds to
the dimension value which does
not change during that rotation

Rotation in 3D
• Rotation around an arbitrary
axis can be represented
with rotation matrices coming
from Euler angles

Rotation in 3D
• Again, as usual, changing the
order of rotations will result in a
very different final rotation

Viewing
• In our course we want to render
an image starting from a 3D
model

Viewing
• In our course we want to render
an image starting from a 3D
model
• The image capturing the 3D
model from a certain viewpoint

Viewing
• Each 3D object we will work on is
defined in its model/object space

Viewing
• Each 3D object we will work on is
defined in its Model/Object Space
• How to put them into my
Scene/World Space? With 3D
transformations!
• What we miss here in order to do
the rendering? A camera!

Viewing

Viewing
• In fact, rendering a scene onto
a raster image can be imagined
as collapsing a 3D scene into a
2D image
• (still, the 3D information is not
totally destroyed)

Viewing
• The actual path of a 3D point up
to the 2D point on screen is a
sequence of transformations
between different coordinates
systems

Camera View Volume

Camera View Volume
• First of all, it makes sense to put the
origin of the coordinate system into
the center of the screen!

Viewing
• Then, it makes sense to put x and y
axes along the monitor rectangle
• (be aware of different possible
choices)

Viewing
• Finally, with the right hand rule, we
find out that Z axis is exit towards
the screen
• This means that the scene has
negative zeta values

Viewing
• Finally, with the right hand rule, we
find out that Z axis is exit towards
the screen
• This means that the scene has
negative zeta values
• This coordinate system is called
View / Camera Space
• The volume represented in that
slide is called View Volume

Viewing
• Our View/Camera Space
needs to be defined in the
World Space by placing
its coordinate system
• How to set up this coord
frame? Usually in CG
we define the virtual camera
in some position, and we
define which is Z and Y(up
vector) orientation w.r.t. the
Scene/World space (the third
axis is then fixed)
• Finally, we derive the matrix
which described this Scene-
Camera transformation

Projection
• We need to define view
volume parameters
• Our view Volume will be
mapped onto the canonical
view volume
• This mapping is called
Projection

Projection

Projection

Projection
• The canonical view volume
implifies several operations,
such as clipping away pixels
which are not visible

Projection
| • The   | canonical   | view  | volume          | simplifies  |     |
| ------- | ----------- | ----- | --------------- | ----------- | --- |
| several | operations, |       | such            | as clipping | a   |
| way     | pixels      | which | are not visible |             |     |
• The canonical view volume is a
| cube | with sides of length equal to 2 |     |     |     |     |
| ---- | ------------------------------- | --- | --- | --- | --- |

Projection
| • The   | canonical |             | view | volume          | simplifies  |
| ------- | --------- | ----------- | ---- | --------------- | ----------- |
| several |           | operations, |      | such            | as clipping |
| away    | pixels    | which       |      | are not visible |             |
• The canonical view volume is a
| cube | with sides of length equal to 2 |     |     |     |     |
| ---- | ------------------------------- | --- | --- | --- | --- |
• The view volume instead could even
not be a cube!

Projection

Projection
• We need some sort of
transformation matrix to
move from View Volume to
Canonical View Volume

Projection
• We need some sort of
transformation matrix to
move from View Volume to
Canonical View Volume
• The last row is the usual
"trick" one

Projection
• We need some sort of
transformation matrix to
move from View Volume to
Canonical View Volume
• The last row is the usual
"trick" one
• The axes of View Volume and
Canonical View Volume are
aligned, so there is no
rotational component! Only
non-uniform scaling one

Ortographic Projection
• "easiest" projection
• The non-uniform scaling is
changing the view volume
size onto the canonical view
volume size
• The translation part is moving
the origin to the new frame

Ortographic Projection
• "easiest" projection
• The non-uniform scaling is
changing the view volume
size onto the canonical view
volume size
• The translation part is moving
the origin to the new frame
• It is often arranged in
this other way

Ortographic Projection
• Every object keeps its size,
regardless of actual distance
• Very useful projection for design
related stuffs
• Not realistic

Perspective Projection
• The View Volume is a frustrum

Perspective Projection
• The View Volume is a frustrum
• It has a centre of projection

Perspective Transformation
• We would like to perform a
(perspective) transformation to go back
to an usual view volume structure
• Then, the rest of the pipeline is the
same (ortographic projection, viewport
transformation)

Perspective Transformation
• We would like to perform a
(perspective) transformation to go back
to an usual view volume structure
• Then, the rest of the pipeline is the
same (ortographic projection, viewport
transformation)

Perspective Transformation
• The transformation can be derived
geometrically by looking at the
properties of those rays

Perspective Transformation
• Dividing by Pz is tricky as I want to write
everything as matrix multiplication
• Homogeneous coordinates will save us
again!

Homogeneous coordinates trick n.2
• This property really makes sense as the
additional dimension should not
correspond to an additional degree of
freedom

Perspective Transformation
• Is is what I would like to get

Perspective Transformation
• This is what I can get

Perspective Transformation
• Very simple matrix form thanks to
this trick
• What to do with the ? ?

Perspective Transformation
• Very simple matrix form thanks to
this trick
• What to do with the ? ?
• I need some sort of values which do
not destroy the Pz value, because I
would like to carry my depth
information

Perspective Transformation
• Very simple matrix form thanks to
this trick
• What to do with the ? ?
• I need some sort of values which do
not destroy the Pz value, because I
would like to carry my depth
information
• Putting 0 0 1 0 as row does not work

Perspective Transformation
• What's the effect of those values?

Perspective Transformation
• What's the effect of those values?
• For Pz = n, I get P'z = n as well!

Perspective Transformation
•
What's the effect of those values?
| • For | Pz = n, I get P'z = n as well! |         |        |       |
| ----- | ------------------------------ | ------- | ------ | ----- |
| • For | Pz = f, I                      | get P'z | = f as | well! |

Perspective Transformation
•
What's the effect of those values?
| • For                     | Pz = n, I get P'z = n as well! |         |        |             |
| ------------------------- | ------------------------------ | ------- | ------ | ----------- |
| • For                     | Pz = f, I                      | get P'z | = f as | well!       |
| • I am not preserving the |                                |         |        | true depth  |
values, but I get something which is
equal to depth at the extremes,
| and |  "close enough" in the middle |     |     |     |
| --- | ----------------------------- | --- | --- | --- |

Full pipeline of Perspective Projection

Comparing Projections
• For more info there is a nice explanation with WebGL code as well: link
Other useful links: link2

Canonical View Volume to Screen
• Last transformation required to get
the image on the screen
• The coordinate system of the
Canonical View Volume is called
normalized device coordinates (NDC)

Canonical View Volume to Screen
| The canonical view volume needs to be  |        |     |
| -------------------------------------- | ------ | --- |
| mapped to the screen that has          | n  x n |     |
|                                        | x      | y   |
pixels in a way so that points with x=-1
and x=1 are respectively mapped to the
left and right sides of the screen, while
points with y=-1 and y=1 are mapped to
the bottom and top sides of the screen
respectively
The mapping is linear and can be found
with linear interpolation. More info
here: link

Canonical View Volume to Screen
Another nice recap about the whole pipeline is at this linkGPU Pipeline

What is a GPU?
• Is this a GPU?

What is a GPU?
| • Differences | between | GPU and Graphics cards |
| ------------- | ------- | ---------------------- |

What is a GPU?
| • Differences | between | GPU and Graphics cards |
| ------------- | ------- | ---------------------- |
•
GPU is actually included into Graphics cards, together with other stuffs

What is a GPU?
| • Differences | between | GPU and Graphics cards |
| ------------- | ------- | ---------------------- |
•
GPU is actually included into Graphics cards, together with other stuffs
| • Memory, heat | pipes, connectors... |     |
| -------------- | -------------------- | --- |

Actual GPU
• This little square is what we actually call GPU, and it performs all the computations we are
interested to
| • We | are not concerned |              | on the | GPU hardware | details |
| ---- | ----------------- | ------------ | ------ | ------------ | ------- |
| • We | care about        | GPU pipeline |        |              |         |

GPU pipeline in a nutshell
?
• GPU (or graphic) pipeline is "a framework within computer graphics that outlines the
necessary procedures for transforming a three-dimensional (3D) scene into a two-
dimensional (2D) representation on a screen." (cit. Wikipedia)
• What type of input data is needed?

GPU pipeline in a nutshell
• GPU (or graphic) pipeline is "a framework within computer graphics that outlines the
necessary procedures for transforming a three-dimensional (3D) scene into a two-
dimensional (2D) representation on a screen." (cit. Wikipedia)
• Generic "scene data"

GPU pipeline in a nutshell
• GPU (or graphic) pipeline is "a framework within computer graphics that outlines the
necessary procedures for transforming a three-dimensional (3D) scene into a two-
dimensional (2D) representation on a screen." (cit. Wikipedia)
• …actually a bunch of triangles!

GPU pipeline in a nutshell
• Triangles (and in general scene data) come from GPU memory
• The output is usually rendered on a monitor

GPU pipeline in a nutshell
• Data in GPU memory comes from CPU memory

GPU pipeline in a nutshell
• Scene data comes from CPU application
• GPU has several subtasks to accomplish
• Even in case of CPU+GPU hybrid hardware, tasks are still separated

GPU pipeline more in detail
•
| Each | pipeline step accomplish one or more | important task |
| ---- | ------------------------------------ | -------------- |
• Other optional steps are available in OpenGL(but not WebGL)
• Interesting resource: https://graphicscompendium.com/intro/01-graphics-pipeline​

GPU pipeline more in detail
• Who is responsible of commanding this pipeline to the GPU?

GPU pipeline more in detail
• Who is responsible of commanding this pipeline to the GPU?
• ...Graphics API!

GPU pipeline more in detail
•
Who is responsible of commanding this pipeline to the GPU?
• ...Graphics API!
| • OpenGL, | WebGL, DirectX, | Metal, Vulkan... |
| --------- | --------------- | ---------------- |

GPU pipeline more in detail
• Who does call the API functions and who does supply the scene data?

GPU pipeline more in detail
• Who does call the API functions and who does supply the scene data?
• Your application!

WebGL javascript API
• WebGL is a subset of OpenGL API which works through any HTML 5 browser

WebGL javascript API
• WebGL is a subset of OpenGL API which works through any HTML 5 browser
• In particular, is based on OpenGL ES 2.0 (embedded OpenGL version)

WebGL javascript API
• WebGL advantages: very easy to setup, and works the same on any computer :-)
• WebGL disadvantages: does not support some advanced OpenGL functionality, e.g. tasselation
shader :-(

WebGL javascript API

|                    | WebGL      |           | javascript API |            |           |        |
| ------------------ | ---------- | --------- | -------------- | ---------- | --------- | ------ |
| HTML5 & Javascript | Javascript | & OpenGL  |                | Javascript | & OpenGL  |        |
|                    | shading    | language  | (GLSL)         | shading    | language  | (GLSL) |
• Doing graphic with WebGL means writing code in several, different languages

WebGL javascript API
• Doing graphic with WebGL means writing code in several, different languages
• High level libraries can be exploited to do more in less time

WebGL javascript API
• Doing graphic with WebGL means writing code in several, different languages
• High level libraries can be exploited to do more in less time
• Three.js is a Javascript-based WebGL engine!

WebGL - initialization

WebGL - initialization
• This initialization is needed to tell the browser where we want to display our WebGL graphic
• ...where do we want to display our WebGL graphic??

| WebGL | - initialization | (1) |
| ----- | ---------------- | --- |
• This initialization is needed to tell the browser where we want to display our WebGL graphic
•
...where do we want to display our WebGL graphic??
• ...on the canvas "mycanvas" :-)

WebGL - initialization (2)
| • Simply need to obtain the | webgl | context from the canvas |
| --------------------------- | ----- | ----------------------- |
• We can think "gl" as a class, with a bunch of different functions that control the GPU
• (often) optional parameters which we are not interested into

WebGL - initialization (2)
• Canvas.width(*height) is the actual rendered images resolution, canvas.clientWidth(*height) is the
canvas size
• Gl.viewport define which portion of the canvas I want to use for displaying the images
• Canvas.clientWidth(*height) is actually in pixels, but they could our could not correspond to real
screen pixels (e.g. 4k smartphones)

WebGL - initialization (2)
• Canvas.clientWidth(*height) is actually in pixels, but they could our could not correspond to
real screen pixels (e.g. 4k smartphones)

WebGL - initialization (2)

WebGL - scene data
| • Every | primitive is | defined | by vertices |
| ------- | ------------ | ------- | ----------- |

WebGL - scene data

WebGL - scene data

WebGL - scene data

WebGL - scene data
| • The meaning | of these | values | are defined | by me |
| ------------- | -------- | ------ | ----------- | ----- |

WebGL - scene data

WebGL - scene data
| • var positions is |          | a      |          |
| ------------------ | -------- | ------ | -------- |
| javascript         | variable |        | which    |
| does               | not have | any    | special  |
| meaning            | to WebGL |        | – I      |
| assign             | these    | values | to a     |
| WebGL              | entity   |        |          |

WebGL - scene data
• WebGL uses a peculiar buffer mechanism to pass data from javascript code(CPU memory) to
GPU memory

WebGL - scene data
• There is no direct GPU memory allocation
• Each variable which I want to send to GPU requires the buffer&bind calls

WebGL - GPU pipeline

Vertex Shader – in a nutshell
• Vertex Shader is taking the input scene data and is converting everything into the Canonical
View Volume, giving the results of the transformations to the Fragment Shader (through the
Rasterizer process) for the actual pixels visualization

Vertex Shader
• GLSL is C-like code
• pos and clr are coming from the javascript code
• gl_Position is a special, built-in GLSL variable! More info
at https://www.khronos.org/opengl/wiki/Built-in_Variable_(GLSL)

Vertex Shader
• Vertex Shader code runs one time for each vertex!
• This code is actually transforming the position vector into a 4 coordinates homogeneous vector, and....
• ...is putting gl_Position of each vertex equal to that homogeneous vector
• However, rasterizer when looking on gl_Position values it espect them into the canonical volume
coordinates, so...

Vertex Shader
• ...so, in order to transform pos to the canonical volume system of coordinates, I multiply it with a
matrix!
• Attributes are coming from the buffer mechanism and so they change at each vertex shader
application, while uniform are "variables constant over vertex and fragment shader", and need to
be set into the JS code in a special way.

Vertex Shader
• What about color (clr attribute) ?

Vertex Shader
• As Vertex Shader is the only shader which is actually receiving scene data, I need to pass color
data to Fragment Shader!
• I can do it with by declaring and using a varying variable

Fragment Shader
• I need to declare the same varying variable defined into Vertex Shader

Fragment Shader
• I need to declare the same varying variable defined into Vertex Shader
• Fragment Shader is running on each fragment!

Fragment Shader
• I need to declare the same varying variable defined into Vertex Shader
• Fragment Shader is running on each fragment!
• All fragments whose coordinates are in-between vertexes will have interpolated color values!

Fragment Shader
• The values are approximated by an interpolation formula
• More info available here: https://webglfundamentals.org/webgl/lessons/webgl-3d-
perspective-correct-texturemapping.html

Shaders compilation
• I need to create the shader from the JS side, associate it with the source code, and compile it!
• Always add a check whenever the compilation went wrong

Shaders compilation
• Then, create a "program", attach the shaders, and link it! :)

Setting uniform variables
• Then, create a "program", attach the shaders, and link it! :)

WebGL naming convention
• This convention is used in most of the WebGL functions

WebGL naming convention
• Extra v means that p is an array of values

WebGL naming convention

WebGL naming convention

WebGL naming convention

Rendering

Rendering
https://graphics.cs.utah.edu/courses/cs4600/fall2021/square.htmlSurfaces
• We will try to answer the question: how a 3D model is...modeled? :-)

3D models
| • This seems | to be | something | "solid", but it | is not! |
| ------------ | ----- | --------- | --------------- | ------- |

3D models
| • We | are | used to | think about | object | as full | of stuffs |
| ---- | --- | ------- | ----------- | ------ | ------- | --------- |
• In Computer Graphics we don't build items in this way; we give the illusion of being full, while
| in reality |     | we are | displaying | an hollow | surface |     |
| ---------- | --- | ------ | ---------- | --------- | ------- | --- |

3D models
• Just another example: in order to show a realistic person I don't need to model his digestive
system!

3D models
• Just another example: in order to show a realistic person I don't need to model his digestive
system!
• The main idea is: ignore all complexity of reality, and model only what is actually needed!

Surfaces
• One way of representing surfaces is through an implicit representation

Surfaces
• Implicit formulation can be used to model awesome structures like this (fractals!)
• But in practice, implicit formulation is not used very often...with some exceptions.

Surfaces
• Among the several ways of representing a sphere in Computer Graphics, an implicit
| formulation | is the | most | realistic | one |
| ----------- | ------ | ---- | --------- | --- |

Surfaces
• Among the several ways of representing a sphere in Computer Graphics, an implicit
| formulation | is the | most | realistic | one |
| ----------- | ------ | ---- | --------- | --- |

Surfaces
• Among the several ways of representing a sphere in Computer Graphics, an implicit
| formulation | is the | most | realistic | one |
| ----------- | ------ | ---- | --------- | --- |

Surfaces
• Another example of entity which is well defined by implicit representation is the infinite plane

Surfaces
• Another example of entity which is well defined by implicit representation is the infinite plane

Surfaces
• You can in theory model everything with implicit formulation, but..

Surfaces
• You can in theory model everything with implicit formulation, but..
| • ...but it | becomes | tricky | and unfeasible | very soon! |
| ----------- | ------- | ------ | -------------- | ---------- |

• The same idea of Bezier Curves can be exploited to do Bezier Patches

• The same idea of Bezier Curves can be exploited to do Bezier Patches

Bezier Patches
• The same idea of Bezier Curves can be exploited to do Bezier Patches

Bezier Patches
• The same idea of Bezier Curves can be exploited to do Bezier Patches
• It has been extensively used in the past, not so much nowadays

Bezier Patches
• The Utah Teapot is a famous example of a collection of bezier patches

Bezier Patches

NURB Surfaces
• Non-Uniform Rational B-spline

NURB Surfaces

Polygonal Meshes
• "In 3D computer graphics and solid modeling, a polygon mesh is a collection
of vertices, edges and faces that defines the shape of a polyhedral object.
• The faces usually consist of triangles (triangle mesh), quadrilaterals (quads), or other simple convex
polygons (n-gons), since this simplifies rendering, but may also be more generally composed
of concave polygons, or even polygons with holes."

Polygonal Meshes
• The more the number of polygons in a mesh, the more details I am able to represent
• Nowadays it is the most popular method for modeling surfaces

Polygonal Meshes
• O polygon mesh is made of...polygons, and each polygon has a number of vertices and edges
| • Each | polygon | is a small | piece | of the | surface |
| ------ | ------- | ---------- | ----- | ------ | ------- |

Polygonal Meshes
| • In order | to define | a polygon, I need        | a list | of vertices        |
| ---------- | --------- | ------------------------ | ------ | ------------------ |
| • And to   | define    | a polygonal mesh, I need |        | a list of polygons |

Polygonal Meshes

Polygonal Meshes

Polygonal Meshes
• Advantage: it gives full control during the modeling process
| • Disadvantage: It | is a quite | labour-intensive task |
| ------------------ | ---------- | --------------------- |

Polygonal Meshes
• It can quickly become a VERY hard work when the number of polygons are increasing

Polygonal Meshes
• It can quickly become a VERY hard work when the number of polygons are increasing
• Luckly, we have very nice tool to help us with this process

Subdivision
• Subdivision is the process of generating high resolution meshes by splitting polygons of low resolution
meshes

Subdivision
• Subdivision is the process of generating high resolution meshes by splitting polygons of low resolution
meshes
• In this example however, subdivision algorithm is followed by some refinement which performed also
a topological modification

Catmull-Clark subdivision
• Most popular subdivision method among all the possible ones
• It consists in calculating the mean point of sides and edges to create new sides and edges

Catmull-Clark subdivision
• Most popular subdivision method among all the possible ones
• It consists in calculating the mean point of sides and edges to create new sides and edges
• The resulting mesh is in general smoother than the original

Catmull-Clark subdivision
• The series of polygons obtained with this process approaches a limit surface
• It also shows interesting properties, such as being C2 continue on every point but C1 on
extraordinary points

Catmull-Clark subdivision
• It can be used on non-quad meshes and it still produce quad smoother meshes, but is not as
| quite | as effective | as with | quad | meshes |
| ----- | ------------ | ------- | ---- | ------ |

Catmull-Clark subdivision
• For this reason we will work with most quad meshes with few triangles in between to not be
restricted in topology

Subdivision modeling
| • How | to obtain | this? |
| ----- | --------- | ----- |

Subdivision modeling
| • First start | with low | resolution | mesh... |
| ------------- | -------- | ---------- | ------- |

Subdivision modeling
• Then apply subdivision and eventually some manual refinements

Subdivision modeling
• Then apply subdivision and eventually some manual refinements

Blender
| • Best available | modeling | software |     |
| ---------------- | -------- | -------- | --- |
• It is free!
| • Can do everything | from | modeling | to animation |
| ------------------- | ---- | -------- | ------------ |
•
It is easy-to-use with respect to other available software (Autodesk 3DS Max, Maya, Rhino)Triangular Meshes
| • The best | polygon | for | 3D modeling | is quad, but... |
| ---------- | ------- | --- | ----------- | --------------- |
• ...at the end of the day, I will convert my model into a triangular mesh
| • And for | a very | good | reason! |     |
| --------- | ------ | ---- | ------- | --- |

Triangular Meshes
• The reason is that three points in space define not only an unique triangle, but also an unique
| plane,            | which | is a linear shape! :-) |       |        |     |
| ----------------- | ----- | ---------------------- | ----- | ------ | --- |
| • The same cannot |       | be said                | about | a quad | :-( |

Triangular Meshes
| • In fact, 4 points | in 3D space | represents | a bilinear patch |
| ------------------- | ----------- | ---------- | ---------------- |

Triangular Meshes
• So, triangles give us the simplicity of a locally linear surface...
• ...and if we want to represent curved surfaces, we just keep adding more (and smaller)
triangles :-)

Triangular Meshes
• A sphere represented with triangles will never be perfect like an implicitly-formulated sphere,
but...
• Who cares if we can make triangles smaller than a pixel? :-)

Triangular Meshes
| • However, not every |             | object |        | can         | be      |     |
| -------------------- | ----------- | ------ | ------ | ----------- | ------- | --- |
| efficiently          | represented |        | with   | triangles:  |         |     |
| for example, hairs   |             | are    | better |             | modeled |     |
with splines!
•
| Still, even        | splines | can  | be  | converted |        | to  |
| ------------------ | ------- | ---- | --- | --------- | ------ | --- |
| triangles, because |         | this | is  | what      | GPU is |     |
| able to render     |         |      |     |           |        |     |

Triangles
| • Where | is that | P in space? |     |
| ------- | ------- | ----------- | --- |
• I need a way to computer position in space of all points of that triangle, because from these
| points | I will obtain | pixels | (fragments) ! |
| ------ | ------------- | ------ | ------------- |

Triangles
• Because the three points P0,P1 and P2 lies on the same plane, all points on that plane can be
| represented | as a linear combination | of these | three | points. |
| ----------- | ----------------------- | -------- | ----- | ------- |
• Any point, not only the one inside the triangle, can be expressed as a linear combination of these three
points

Barycentric coordinates
• The barycentric coordinates enable the expression of P as a linear combination of P0, P1, P2
• Why 3 coordinates? I should be able to represent a point on a plane with 2 coordinates!

Barycentric coordinates
| • The barycentric | coordinates | sum up | to 1 |
| ----------------- | ----------- | ------ | ---- |

Barycentric coordinates
• The barycentric coordinates sum up to 1 – for ANY point on the plane

Barycentric coordinates
• The barycentric coordinates sum up to 1 – for ANY point on the plane
• But if the point is inside the triangle, each barycentric coordinate is positive and in [0,1]

Barycentric coordinates

Barycentric coordinates

|     |     | Barycentric |     |     | coordinates |
| --- | --- | ----------- | --- | --- | ----------- |
• It is a very useful representation to interpolate values inside the triangle – we can use it to
| calculate | the position | of each | point | in the | triangle |
| --------- | ------------ | ------- | ----- | ------ | -------- |
• Not only position, but also color value, texture, etc we will store this data only on vertices!

Barycentric coordinates
•

|         |                  | Barycentric |             | coordinates | calculation |
| ------- | ---------------- | ----------- | ----------- | ----------- | ----------- |
| • Those | a0, a1, a2 areas |             | are easy to | calculate   |             |

|         |            | Barycentric |          | coordinates  | calculation |
| ------- | ---------- | ----------- | -------- | ------------ | ----------- |
| • Those | a0, a1, a2 | areas       | are easy | to calculate |             |
• Intuitive demonstration

|     |     | Barycentric | coordinates | calculation |
| --- | --- | ----------- | ----------- | ----------- |
• Area of a triangle, given the three vertices coordinates, can be calculated as half the length of
| the cross | product | vector: |     |     |
| --------- | ------- | ------- | --- | --- |
• Moreover, if using perspective projection, there is a different formula needed to correct
perspective distortion
• More info at https://en.wikibooks.org/wiki/GLSL_Programming/Rasterization

Barycentric coordinates in the GPU pipeline

Barycentric coordinates in the GPU pipeline
• Barycentric coordinates are calculated in the center of those squares and fed to the fragment
shader for interpolating

Barycentric coordinates in fragment shader

Triangular meshes data representation
• This is the most straightfoward representation, but not the only one

Triangular meshes data representation
• This is the most straightfoward representation, but not the only one

Triangular meshes data representation
• What happens if these two are actually triangles of a quad?
•

Triangular meshes data representation
• What happens if these two are actually triangles of a quad?
• Redundancy!

Triangular meshes data representation
• What happens if these two are actually triangles of a quad?
• Redundancy!
• On average, a vertex get repeated six times in a quad polynomial mesh

Triangular meshes data representation
• I would like to represent my entity with the minimum number of vertices

Triangular meshes data representation
• Solution n. 1: use Elements!
• Same idea of a color table

Triangular meshes data representation
• Solution n. 1: use Elements!
• Same idea of a color table
• Still some redundancy, but now I am replicating indices instead of full attributes

Triangular meshes data representation
• Cannot use drawTriangles; instead, I must use drawElements:
gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

Triangular meshes data representation
• Cannot use drawTriangles; instead, I must use drawElements:
gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
• The drawElements function can be used for other primitives as well

Triangular meshes data representation
• There is an even more efficient representation
• With this approach, order of vertices matter

Triangular meshes data representation
• There is an even more efficient representation
• With this approach, order of vertices matter
• Triangle strips!

Triangular meshes data representation

Triangular meshes data representation
• By carefully ordering my vertices, I can speed up rasterization by minimizing redundancy
• However, now I need to convert my quad mesh not only into triangles (easy) but more
specifically into triangle strips (harder)

Triangular meshes data representation
• Hopfield Triangle Strip GENerator
• The rasterization is optimized while moving along the strip – but each strip share the border
vertices with other strips, and so will be duplicated in my vertex buffer

Triangular meshes data representation
• Hopfield Triangle Strip GENerator
• The rasterization is optimized while moving along the strip – but each strip share the border vertices
with other strips, and so will be duplicated in my vertex buffer
• With vanilla method, vertices are duplicated six times on average; with this method only two times

Triangular meshes data representation
• Another optimized structure is the TRIANGLE_FAN, but used seldom w.r.t. TRIANGLE_STRIP

Triangular meshes data representation
• Another optimized structure is the TRIANGLE_FAN, but used seldom w.r.t. TRIANGLE_STRIP
• I can combine DrawElements with these optimized structures to remove even more redundancy

Triangular meshes data representation
• Another optimized structure is the TRIANGLE_FAN, but used seldom w.r.t. TRIANGLE_STRIP
• I can combine DrawElements with these optimized structures to remove even more redundancy
• In the related project we will simply work with gl.TRIANGLES :-)

| Quad – triangle mesh | conversion | (Triangulation) |
| -------------------- | ---------- | --------------- |
• This conversion is mostly made when exporting the mesh model, e.g. in Blender
• You can split a quad and a polygon in several ways: fixed, shortest diagonal, longest diagonal
• https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/triangulate.html

| Quad – triangle mesh | conversion | (Triangulation) |
| -------------------- | ---------- | --------------- |
• Delaunay triangulation is very useful for splitting N-polygon while guaranteeing certain
propertiesTextures
• A texture is a bidimensional raster image reproduced on a 3D polygonal mesh.

Textures
• A texture is a bidimensional raster image reproduced on a 3D polygonal mesh.
| • Why | should | I put an image | of bricks | on a teapot? |
| ----- | ------ | -------------- | --------- | ------------ |

Textures
• A texture is a bidimensional raster image reproduced on a 3D polygonal mesh.
| • Why        | should | I put   | an image | of bricks | on a teapot? |
| ------------ | ------ | ------- | -------- | --------- | ------------ |
| • The answer |        | is: why | not? :-) |           |              |

Textures
• Jokes aside, textures is the way we represent realistic surfaces on our 3D models
•
| How | do I map | the image | to the | model? |
| --- | -------- | --------- | ------ | ------ |

Textures
• I could do a simple linear/planar map onto one or more 3D model planar surfaces

Textures
• I could do a simple linear/planar map onto one or more 3D model planar surfaces

Textures
| • I could | do a cylindrical | mapping |
| --------- | ---------------- | ------- |

Textures
| • I could | do a spherical | mapping |     |     |     |     |
| --------- | -------------- | ------- | --- | --- | --- | --- |
•
| Heavily | distorted | image | when | transferred | on the | model |
| ------- | --------- | ----- | ---- | ----------- | ------ | ----- |

Textures
•
| I could | do a shrink | wrap | mapping |
| ------- | ----------- | ---- | ------- |

Textures
•
| I could     | do a shrink | wrap | mapping |        |
| ----------- | ----------- | ---- | ------- | ------ |
| • All these | mappings    | are  | pretty  | simple |

Textures
•
| I could     | do a shrink | wrap    | mapping |                 |
| ----------- | ----------- | ------- | ------- | --------------- |
| • All these | mappings    | are     | pretty  | simple          |
| • But what  | about       | mapping | to      | a dinosaur? :-) |

Texture (UV) mapping
• The main technique to map texture on 3D meshes is called Texture Mapping or UV Mapping

|     | Texture | (UV) mapping |
| --- | ------- | ------------ |
•
The main technique to map texture on 3D meshes is called Texture Mapping or UV Mapping
| • As Cem Yuksel says, "texture | mapping | is horrible" |
| ------------------------------ | ------- | ------------ |

Texture (UV) mapping
• This is what people usually think when talking about texture mapping

Texture (UV) mapping
• This is what people usually think when talking about texture mapping

Texture (UV) mapping
• This is the actual texture mapping: from the object space to the texture space!

Texture (UV) mapping
• This is the actual texture mapping: from the object space to the texture space!

Texture (UV) mapping
• Texture mapping boils down into finding the coordinates of each vertex on the texture space

Texture (UV) mapping
• Texture mapping boils down into finding the coordinates of each vertex on the texture space
• In order to do so, I need to put a coordinate system on the texture too

Texture (UV) mapping
• The texture mapping mechanism is applied piece-wise, for each triangle
• It seems a nice method if someone gives you the [x y z ] → [u v ] mapping for each triangle :-)
• The horror part starts when YOU are the one doing that labour :-)

|         |        |          | Textures |               | in the | GPU pipeline |
| ------- | ------ | -------- | -------- | ------------- | ------ | ------------ |
| • Where | to put | textures | in our   | GPU pipeline? |        |              |

|     |     | Textures | in the | GPU pipeline |
| --- | --- | -------- | ------ | ------------ |
• Textures are needed when calculating the color of the fragment, so we will feed them to the
| fragment | shader |     |     |     |
| -------- | ------ | --- | --- | --- |
• However, when feeding vertices to the vertex shader we feed also texture coordinates for each
| vertex | as a vertex | attribute |     |     |
| ------ | ----------- | --------- | --- | --- |

|     |     |     | Textures |     | in the | GPU pipeline |
| --- | --- | --- | -------- | --- | ------ | ------------ |
•
| Rasterizer | needs | to interpolate |     | fragment | texture | coordinates |
| ---------- | ----- | -------------- | --- | -------- | ------- | ----------- |

| Textures | in the | GPU pipeline |
| -------- | ------ | ------------ |
•
GPU can use barycentric coordinates to interpolate in the vertices (object) space...

|         |         |               | Textures |         | in the | GPU pipeline |
| ------- | ------- | ------------- | -------- | ------- | ------ | ------------ |
| • ...as | well as | interpolating | in the   | texture | space! |              |

| Textures | in the | GPU pipeline |
| -------- | ------ | ------------ |
• We don't have to worry too much about this as the GPU automatically do it for us

|             |            | Textures    | in the | GPU pipeline |
| ----------- | ---------- | ----------- | ------ | ------------ |
| • It seems  | everything | is solved.. |        |              |
| • ...but it | is not :-) |             |        |              |

|        |         |         | Texture  |                     | sampling | / filtering |
| ------ | ------- | ------- | -------- | ------------------- | -------- | ----------- |
| • Lets | pretend | this is | our (low | resolution) texture |          |             |

|              |         |                | Texture  |                     | sampling | / filtering |
| ------------ | ------- | -------------- | -------- | ------------------- | -------- | ----------- |
| • Lets       | pretend | this is        | our (low | resolution) texture |          |             |
| • But pixels |         | are not little | squares  |                     |          |             |

Texture filtering
| • Pixels are | more | like values | at certain | points |     |
| ------------ | ---- | ----------- | ---------- | ------ | --- |
•
| Pixels in the | context | of textures | are called | texels | :-) |
| ------------- | ------- | ----------- | ---------- | ------ | --- |

Texture filtering
• Now lets pretend we want to find the texel value of a fragment mapped there
•
| What     | is the         | texel | value? |            |     |
| -------- | -------------- | ----- | ------ | ---------- | --- |
| • I need | to approximate |       |        | it in some | way |

Nearest filtering
• The easiest solution is to approximate the value with the nearest texel
•
Disadvantage: the point is approximated with a fixed value up to some position, where
| the value | suddenly | "jumps" on another | texel | value |
| --------- | -------- | ------------------ | ----- | ----- |

Bilinear filtering
| • Bilinear filtering | involves | some | linear interpolation |
| -------------------- | -------- | ---- | -------------------- |
•
It is better than nearest filtering as now the interpolated value changes more smoothly
w.r.t. point position

Bilinear filtering
| • Bilinear filter | is about | "double linear interpolation" |
| ----------------- | -------- | ----------------------------- |
•
The equation involved is pretty simple, but not as simple as nearest filtering

Bilinear filtering

Bilinear filtering

Bilinear filtering

Bilinear filtering
• These equations can be merged into a single one

Bilinear filtering
• A nice thing to notice is that the weights of c0-c1-c2-c3 corresponds to the areas of
the opposite square

Filtering comparison
• Bilinear filtering results into a smoother image

Filtering comparison
• Bilinear filtering results into a smoother image
• Can you see still see the individual texels in bilinear filtering?

Filtering comparison

Filtering comparison

Filtering comparison
• All these methods cannot create more information; they can only make of a better
use the current information
• Newest methods can "allucinate" more information (Deep Learning!)

Filtering comparison
• Take home message should be: use the highest resolution texture that guarantees not
recognizing texels
| • However, there | is another | issue |
| ---------------- | ---------- | ----- |

Filtering comparison
• When choosing texture resolution, we should aim at high enough resolution to avoid
getting artifacts on small camera distances

Filtering comparison
• When choosing texture resolution, we should aim at high enough resolution to avoid
getting artifacts on small camera distances

Filtering comparison
• However, the same texture will be also used on objects very far away from the
camera
• This could seem totally fine, but it is not :-D

Filtering comparison
• When texture has a resolution very different w.r.t. screen, or in other words when one
pixel does not correspond to one texel, artifacts will arise
• When several pixels correspond to one texel ( texture oversampling) the resulting
image is "square-ish"

Filtering comparison
• When texture has a resolution very different w.r.t. screen, or in other words when one
pixel does not correspond to one texel, artifacts will arise
• When several texels correspond to one pixel ( texture undersampling) the resulting
image has visual artifacts and flickerings

Filtering comparison
• When texture has a resolution very different w.r.t. screen, or in other words when one
pixel does not correspond to one texel, artifacts will arise
• When several texels correspond to one pixel ( texture undersampling) the resulting
image has visual artifacts and flickerings

Filtering comparison
• Why this is happening? How to get the right (no pun intended) result? :-)

Filtering comparison
• In this situation I am rendering this texture

Filtering comparison
• In this situation I am rendering this texture

Filtering comparison
• Lets focus on a particular pixel as example
• The color value happens to be grey!

Filtering comparison
• Lets focus on a particular pixel as example
• The color value happens to be grey!

Filtering comparison
• Now I slighly move my camera, so that there is a slightly shift in the corresponding
texel..

Filtering comparison
• The color value happens to be brown!

Filtering comparison

Filtering comparison

Filtering comparison
• The solution to get rid of this artifact is to not choose a particular texel
• Instead, I should represent the mean value of the texture corresponding to this pixel!

Filtering comparison
• This solution seems conceptually simple, but if the object is very far away, this would
correspond in doing the mean value of an entire (high res!) texture!
• Very expensive operation

Filtering comparison
• This solution seems conceptually simple,but if the object is very far away, this would
correspond in doing the mean value of an entire (high res!) texture!
• It is a costly solution even if pixel correspond to "just" a texture portion

Filtering comparison
• The effective way to calculate this mean value without sacrificing performances is to
do some pre-filtering
• There are several ways to do that, but most popular one is mipmap

Mipmaps
| • The original texture is | defined as | mipmap level 0 |
| ------------------------- | ---------- | -------------- |

Mipmaps
| • The original texture is | defined as | mipmap level 0 |
| ------------------------- | ---------- | -------------- |
• Each successive level is a texture with half resolution (both width and height)

Mipmaps
| • The original texture is | defined as | mipmap level 0 |
| ------------------------- | ---------- | -------------- |
• Each successive level is a texture with half resolution (both width and height)

Mipmaps
| • The original texture is | defined as | mipmap level 0 |
| ------------------------- | ---------- | -------------- |
• Each successive level is a texture with half resolution (both width and height)

Mipmaps
| • The original texture is | defined as | mipmap level 0 |
| ------------------------- | ---------- | -------------- |
• Each successive level is a texture with half resolution (both width and height)

Mipmaps
• If the resolution is a power of 2, every pixel at level N is the mean value of 4 pixels at
level N-1

Mipmaps
• If the resolution is a power of 2, every pixel at level N is the mean value of 4 pixels at
level N-1
• The power of 2 characteristic was mandatory in the past, now it is optional

Mipmaps
• My task is to render this texture area which corresponds to a pixel

Mipmaps
• My task is to render this texture area which corresponds to a pixel
• This shape is first approximated with a square in the texture space

Mipmaps
• My task is to render this texture area which corresponds to a pixel
• This shape is first approximated with a square in the texture space
• Then, the mipmap level X will be chosen so that in that mipmap one texel
corresponds more or less to one pixel!

Mipmaps
• Now I can do bilinear filtering as usual...maybe ;-)
| • There is still an | issue | to tackle... |
| ------------------- | ----- | ------------ |

Mipmaps
• Each mipmap has ¼ of the pixels of the previous level
• This is because I don't wanna waste too much GPU memory on those mipmaps!
• Still, the jump between one mipmap level and another one is too hard..

Mipmaps
• Best thing to do is to get the mipmap level where the texels are just a bit bigger than
a pixel, a mipmap level where the texels are just a bit smaller than a pixel, and
combine them

Mipmaps
• Best thing to do is to get the mipmap level where the texels are just a bit bigger than
a pixel, a mipmap level where the texels are just a bit smaller than a pixel, and
combine them

Mipmaps
• Best thing to do is to get the mipmap level where the texels are just a bit bigger than
a pixel, a mipmap level where the texels are just a bit smaller than a pixel, and
combine them

Mipmaps
• Best thing to do is to get the mipmap level where the texels are just a bit bigger than
a pixel, a mipmap level where the texels are just a bit smaller than a pixel, and
combine them

Mipmaps
• Best thing to do is to get the mipmap level where the texels are just a bit bigger than
a pixel, a mipmap level where the texels are just a bit smaller than a pixel, and
combine them

Bilinear filter result
• Some patterns arises which should not be present (aliasing)

Mipmap (trilinear) filter result
• Better result, but..
• But...
• ..but we are still not complitely satisfied by it :-)

The mipmaps problem
• The texture representation far away from camera is too much blurry
• This happens because this is the thing we would like to approximate..

The mipmaps problem
• The texture representation far away from camera is too much blurry
• But we are approximating it with this!

The mipmaps problem
• If I would do filtering truly on this sleeve, I would get this instead!

Anisotropic filter result
• If I would do filtering truly on this sleeve, I would get this instead!
• This is called Anisotropic filtering

Anisotropic filter result
• Its implementation is tricky, but conceptually simply: lets approximate this area with
several smaller filters

Filters comparison
• Anisotropic filtering is especially important with far away planes

Final considerations in filtering
• Anisotropic filtering is costly
• However, GPU has dedicated hardware to perform such filtering
• The filtering speed of GPU hardware solution is 10x greater than any software
implementation
• And finally, you don't have to do anything special to implement it!Textures On GPU

Textures On GPU

Textures On GPU
| • Not worthing | going | higher |
| -------------- | ----- | ------ |
dimensions

Procedural Texture
| • Unusual | way of | defining | a texture, but still supported |
| --------- | ------ | -------- | ------------------------------ |

Procedural Texture
| • Unusual | way of | defining | a texture, but still supported |
| --------- | ------ | -------- | ------------------------------ |

Procedural Texture
•
| Unusual | way of | defining | a texture, but still supported |
| ------- | ------ | -------- | ------------------------------ |

Textures coordinate systems
• When we talk about texture, we refer to uv-coordinates to differentiate it from xy
coordinates

Textures coordinate systems
• When we talk about texture, we refer to uv-coordinates to differentiate it from xy
coordinates
• Or we refer to st-coordinates, which are normalized w.r.t. resolution!

Textures coordinate systems
• Textures to GPU are fed in st-coordinates, then it cares of managing the conversion
• If you look at OpenGL/WebGL specifications, those are called st-coordinates, but people
keep referring to them as uv-coordinates!

Textures coordinate systems
• The nice thing about working on normalized coordinates is that we can associate a
texture to a mesh without knowing anything about the texture resolution
• If the texture changes (maybe I develop an higher resolution texture) the same
associations hold!

Texture on GPU
• The use of textures is not difficult but a bit tricky and unintuitive

Texture on GPU
• The use of textures is not difficult but a bit tricky and unintuitive
• For example, what happens if I define a texture point outside the [0-1] range?

Texture on GPU
• The use of textures is not difficult but a bit tricky and unintuitive
• For example, what happens if I define a texture point outside the [0-1] range?
• The results depends on the behavior you choose

Texture on GPU
• With the Clamp to Edge mode the texel value outside boundary is fixed to the
nearest texel

Texture on GPU
• With the Repeat mode the whole texture is getting repeated (default mode)

Texture on GPU
• With the Mirrored Repeat mode the whole texture is getting repeated

Texture on GPU
• Texture is needed in the fragment shader
• We can fed it to the fragment shader with a mechanism like uniform variable
• Here is where the task to do become a little tricky

Texture on GPU
• Before going to the Fragment shader, texture goes into Texture Unit
• The texture unit is responsible of applying bilinear, trilinear, or anisotropic filtering
• It is an hardware unit – we don't wanna do software filtering!

Texture on GPU
• What if a have multiple textures? Do they stack all inside the Texture Unit?

Texture on GPU
• What if a have multiple textures? Do they stack all inside the Texture Unit?
• No!

Texture on GPU
• The perspective from a GPU programmer is that there is a Texture Unit for each texture
• This is true even if the hardware does not actually have them!
• There are also other more advanced ways to access texture in GPU

Texture on GPU
• Lets focus on one single texture

Texture on GPU
• The actual GPU allocation happens while setting texture data
• Every function after the bindTexture call refer to that binded texture. In order to work on
another texture I have to perform another binding
• I can let WebGL generate my mipmaps or I can specify a particular one

Texture on GPU
• Some additional parameters are required
• The gl.LINEAR line specifies bilinear filtering
• The gl.LINEAR_MIPMAP_LINEAR specifies trilinear filtering
• For anisotropic filtering: https://math.hws.edu/graphicsbook/c7/s5.html

Texture on GPU
• I can also set the tiling mode

Texture on GPU
• I can also set the tiling mode
• Now my texture is defined and loaded in GPU memory. How to use it?
• We need to send it to a Texture Unit!

Texture on GPU
• I first need to specify on which Texture Unit I want to send my texture, and then I need to
call bindTexture

Texture on GPU
• Before understanding how to connext Texture Unit to Shader, lets see the GLSL code for
using the texture
• Sampler2D is the type used by WebGL to specify texture
• The texture2D code is sampling the texture at each pixel

Texture on GPU
• The texCoord is coming from the Vertex Shader code
•
| Now | we only | miss this | sampler2D item |
| --- | ------- | --------- | -------------- |

Texture on GPU
• The sampler needs to be defined as other uniform variable – I get the location in the
program, I set which program should I use
• And finally I associate the sampler with the Texture Unit!

Texture on GPU

Texture on GPU
• Whenever I have set up texture and Texture Unit, everything about filtering goes
automatically
• The rasterizer is actually calculating the derivative of every quantity at fragment level, and
this information is used to choose which mipmap to use etcShading
| • It is all about computing color | variations | on surfaces |
| --------------------------------- | ---------- | ----------- |

Shading
• This red teapot is "flat". How can we give the sense of 3D on it?

Shading
• This looks way more tridimensional!
• Just by adding shading

Shading
• Actually, everything about shading boils down to lightning
• More specifically, it boils down to how lights bounces off surfaces

Shading
• We intuitively recognize that the lights source is above the teapot in this case

Shading
• Let's start with a plane, a light source and a vector indicating the light direction

Shading
• Let's start with a plane, a light source and a vector indicating the light direction
• Tilting the plane gives a darker image

Shading
• Let's start with a plane, a light source and a vector indicating the light direction
• Tilting the plane gives a darker image

Shading
• Let's start with a plane, a light source and a vector indicating the light direction
• Tilting the plane gives a darker image, up to total black

Shading
• If I keep rotating I still get black plane as I cannot see the lightened side

Shading
• Let's see this setup in order to introduce some notations

Shading
• Let's see this setup in order to introduce some notations
• n is the normal vector to the plane
• Generically referred as surface normal

Shading
• Let's see this setup in order to introduce some notations
• I can define a tetha angle between omega and surface normal n
• The area on which the lights rays are spreaded is now larger

Shading

Shading
• Light per unit area, L, is scaled
by s

Shading

Shading

Shading
| • The cosθ | is the | Geometry term |
| ---------- | ------ | ------------- |

Shading

Shading
=

Shading
• This is true also for textures, which
will be sampled on every point I am
trying to shade

Shading
• We must take into account also the
light intensity!

Lambertian (Diffuse) Material

Shading

Shading

Specular reflection
• It can be thought as light reflected by our surface

Specular reflection
• The position where the specular reflection is
seen depends on the light source position and on our
position

Phong specular reflection

Phong specular reflection
• r is the perfect reflection

Phong specular reflection
• r is the perfect reflection
• Phong specular model is going to see the difference between our view direction and
the perfect reflection direction

Phong specular reflection
• r is the perfect reflection
• Phong specular model is going to see the difference between our view direction and
the perfect reflection direction
• Alpha takes into account the material roughness

Phong specular reflection
• r is the perfect reflection
• Phong specular model is going to see the difference between our view direction and
the perfect reflection direction
• Alpha takes into account the material roughness

Phong reflection model
• r is the perfect reflection
• Phong specular model is going to see the difference between our view direction and
the perfect reflection direction
• Alpha takes into account the material roughness

Phong reflection model
• Ks is tipically a white or gray value
• Alpha determines the shape of the specular reflection

Phong reflection model
• With a max operation I can solve the issue of negative values

Modified Phong reflection model
•
It seems it would make sense to write it in a form like this, taking out the geometry
term, which in principle should affect the specular part too
| • However, this | would | be the Modified | Phong | reflection | model |
| --------------- | ----- | --------------- | ----- | ---------- | ----- |

Phong reflection model
• The standard Phong model is going back to the original formulation

Phong reflection model
• r can be easily calculated by geometrical construction

| Examples of Phong | specular | reflection |
| ----------------- | -------- | ---------- |
It is an extreme situation

| Examples of Phong | specular | reflection |
| ----------------- | -------- | ---------- |

| Examples of Phong | specular | reflection |
| ----------------- | -------- | ---------- |

| Examples of Phong | specular | reflection |
| ----------------- | -------- | ---------- |

| Examples of Phong | specular | reflection |
| ----------------- | -------- | ---------- |

Blinn reflection model
• Alternative reflection model

Blinn reflection model
• Alternative reflection model
• Phi angle is calculated differently
• It doesn't make sense much w.r.t. Phong formula..

Blinn reflection model
• Alternative reflection model
• Phi angle is calculated differently
• It doesn't make sense much w.r.t. Phong formula..

Blinn vs Phong
• Phong produces more elongated specular lobe
• Blinn produces more circular specular lobe
• Blinn is more realistic

Blinn vs Phong
• If you want to get the same lobe reflection area, then different alpha values should
be used

Material models issue
• Only half of the sphere is hit by light. Following the presented formulas, the other
half is black!
• This is not realistic as in real life there is light bouncing everywhere and still
lighting a little the other side

Material models issue
• Only half of the sphere is hit by light. Following the presented formulas, the other
half is black!
• This is not realistic as in real life there is light bouncing everywhere and still
lighting a little the other side
• The solution: add ambient light

Blinn/Phong Material Model
• It is a crude approximation of the reality
• Ka is usually set as Kd as it makes little sense setting it otherwise

How to handle lights in Computer Graphics?
• Directional light: easy to use, quite decent approximation of the light coming from
the sun

How to handle lights in Computer Graphics?
• Point light: easy to use, the light is coming from a point
• Not the most realistic light representation, as a point is a
dimensionless entity. Still decent for small light sources

How to handle lights in Computer Graphics?
• Spot light: easy to use, the light is coming from a point but, instead of firing light
rays on every direction, it has only some directions
• Both point and spot light require to calculate the light direction

How to handle lights in Computer Graphics?
• Area light: realistic light source, as it has an....area :-)
• Area light are represented as surfaces – even with a polygonal mesh!
• With Area light is computationally expensive to calculate light direction and to do shading

How to handle lights in Computer Graphics?
• Environment light: realistic light coming from all directions
• Can be imagined as coming from a texture of a sphere with infinite radius

• "Image-Based Lighting (IBL) uses an image to produce realistic reflections and ambient
lighting in a 3D scene. It gives subtle lighting effects that help make the objects appear as
though they naturally belong in an environment."

How to handle multiple light sources?
• Cannot take the average of the two (or multiple) light sources, or merge them in some
way.
• In Computer Graphics light sources are additiveShading transformations
• Outline:
o We have seen how to calculate shading - now we see how to interpolate shading
o Different shading types
o Where to apply shading
o Issues when transforming normals
o How to implement shading in WebGL

Shading transformations
• We could deal with implicit sphere in Computer Graphics, which simplifies a lot the use
of normals, but actually...

Shading transformations
| • We | could | deal | with implicit | sphere | in Computer  |
| ---- | ----- | ---- | ------------- | ------ | ------------ |
Graphics, which simplifies a lot the use of normals, but actually...
•
Actually we will way more often work with polygonal meshes :)

Flat shading
• We need to compute the triangle normal
• Very easy: just take the vectors defined by the edges, do the cross product and normalize!
• Not very pleasant result :(

Gouraud shading
• If I have different normals defined for each vertex, I can calculate each vertex shaded
color, and then interpolate!

Gouraud shading
• If I have different normals defined for each vertex, I can calculate each vertex shaded
color, and then interpolate!
• Someone has to provide the normals :)

Gouraud shading
• How to do it on a dinosaur?
• Take normals of each triangle, and then compute a weighted mean to obtain vertices
normals
• It is still part of the modeling process

Gouraud shading
• Why Vertex shader is called vertex shader? Because it was were (Gouraud) shading was
happening :)
• This had the advantage of limiting the shading operations – especially when the number
of vertices is way lesser than the number of pixels

Gouraud shading
• Still, not looking SO MUCH realistic :)
• The specular reflection looks a little...triangulated ;)

Phong shading
• A technique to obtain smooth shading
• Instead of calculating the three colors and then interpolating, lets interpolate the normals
and then calculate the color!

Phong shading
• A technique to obtain smooth shading
• Instead of calculating the three colors and then interpolating, lets interpolate the normals
and then calculate the color!
• What is the missing piece of that formula?

Phong shading
• Need to normalize it!

Phong shading
• Why Phong model is so good?

Phong shading
• Why Phong model is so good?
• Because it is calculating a very good approximation of the "true" normal in that point,
hiding the fact that I have a small number of polygons and making things appear smooth
when they aren't!

Phong shading
• Why Goraud shading is not so good?

Phong shading
• Why Goraud shading is not so good?
• Because Phong interpolates the normals, Goraud interpolates the colors
• If the shading material model we would use would be linear, this would be fine
• But the model is non-linear!

Goraud vs Phong shading
• https://stackoverflow.com/a/63958763
• A nice demo: https://rabbid76.github.io/graphics-
snippets/html/stackoverflow/gouraud_phong.html

Goraud vs Phong shading
• Flat shading means no additional computation at all
• Gouraud shading means computing shading in the vertex shader
• Phong shading means computing shading in the fragment shader

Viewing transformations

Viewing transformations

Shading transformations
• When doing shading, all the vectors must be defined IN THE SAME SPACE
• Said that, we can do shading in each of those spaces!

Shading transformations
• Light is often defined in the world space, so it is a suitable space
• View space is suitable too, as everything will eventually get transformed in that space
• This last choice is actually more preferred, because it could give slightly better
performance

Shading transformations
• If light is defined in the view space, it is "attached" to the camera – it moves around while moving
the camera!
• This will be the case of the next project
• This means that we need Model-View transformation separately, while with previous project we
were working with model-view-projection, which was transforming everything in the canonical
view volume

Shading transformations
• There is still an issue to solve – bringing normals into the View space

Shading transformations
• First thing to remember: if there is a scaling in the transformation, I need to re-normalize
the normals
• It is not a big deal, but there is a subtle effect hidden in the characteristics of normals

Shading transformations
• Rotations and translations does not produce any artifact on normals

Shading transformations
• Non-uniform scaling is not preserving the normal property, which is to be normal to
the surface in that point!
• Something weird is happening – instead of rotating in the expected way, normals are
rotating in the opposite way

Shading transformations
• This is what I had, as normal vectors, before applying the transformation to the normals

Shading transformations
• This is what I would like to obtain

Shading transformations
• This is what I got instead

Shading transformations
• This is what I got instead

Shading transformations
• This is what I got instead
• Surprisingly, to fix this issue I need to apply to the normals the inverse of the uniform
scaling transformation

Shading transformations
• We recognize that the uniform scaling transformation is ruining my normals – but why do
we need the inverse of the uniform scaling ?!

Shading transformations

Shading transformations
• Basic property of tangent and normal vector

Shading transformations

Shading transformations
• We can say that, given the t' vector which underwent a non-scaling transformation, if n'
defined above is the true required transformation, then t' and n' should be perpendicular!

Shading transformations
• We can say that, given the t' vector which underwent a non-scaling transformation, if n'
defined above is the true required transformation, then t' and n' should be perpendicular!

Shading transformations
• Let's remember that, because normals are a direction vector and not a position vector,
the last element in homogeneous coordinates is set to zero
• This gives the ability of normals to not be affected by translations

Shading transformations
• If M contains only rotations, translations and uniform scaling, I can apply M as it is

Shading transformations
• If M contains only rotations, translations and uniform scaling, I can apply M as it is
• In fact, as normals are not affected by translations, I can use the 3x3 submatrix

Shading transformations
• How to solve the issue of non-uniform scaling integrated into this M matrix?
• We could rely on a nice decomposition trick

Shading transformations
• Any 3x3 matrix can be decomposed as a rotation matrix multiplied by a scaling matrix
multiplied by another rotation matrix
• SVD decomposition!

Shading transformations
• This is what I would like to use!
• Very easy to solve, right? Let's do SVD, then invert the S matrix, et voilà!
• Sadly, SVD is very costly and numerically error-prone.

Shading transformations
• A trick will save us

Shading transformations
• Here I applied this property of inverse:

Shading transformations
• Remember: the transpose of a rotation matrix is equal to its inverse

Shading transformations
• Remember: the transpose of a rotation matrix is equal to its inverse

Shading transformations
• Now I can apply another useful property:

Shading transformations
• Now I can apply another useful property:

Shading transformations
• Final property to exploit: the transpose of a diagonal matrix it equal to the matrix

Shading transformations
• Final property to exploit: the transpose of a diagonal matrix it equal to the matrix

Shading transformations
• This is exactly what I was looking for!

Shading transformations

Shading transformations
• Another quick and easy demonstration :)

Shading transformations
• Last thing I need is the view vector

Shading transformations
• Last thing I need is the view vector
• As in the view space the camera is centered in the origin, my view vector is just the –P
vector!The Rendering Equation

• The rendering equation extend the concept of shading into more general terms
•

"In computer graphics, the rendering equation is an integral equation in which the
equilibrium radiance leaving a point is given as the sum of emitted plus reflected
radiance under a geometric optics approximation"

• The rendering equation has been exploited by a family of rendering methods

The Rendering Equation

• This is the rendering equation
• Discovered by James Kajiya in 1986

The rendering equation

• We can recognize that the first teapot is kind
of rough, while the second one is smooth
• Maybe one is simple wood and the second is

with some coat?

Diffuse material

• This is a zoomed portion of a surface slice
• How does the light bounce on it?

Diffuse material

• This is a zoomed portion of a surface slice
• A perfect diffuse material scatters the light on all directions

Specular material

• This is a zoomed portion of a surface slice
• A perfect specular material reflects the light in the perfect reflection direction
• However,  the perfect specular teapot would not look like this...

Specular material

...but like this :)

•
• But this is not what I want. I want to represent a shiny wood teapot!

Surface reflections

• What the surface could look like?

Surface reflections

•

It could look like this

Surface reflections

• Or it could look like this

Surface reflections

• There is something wrong with this

Surface reflections

• There is something wrong with this
• The second teapot should be darker as some light is reflected as specular, some as

diffuse

Surface reflections

• This is linked to the concept of energy conservation
•

In order to get very realistic rendering, we can imagine that we don't want to have
materials which reflect more light than the received one!

Surface reflections

• Casting these concepts into a shading procedure, how could we model the complexity of

this surface in order to be able to calculate the point color?

• We could represent the surface behavior statistically

BRDF

• This foundamental function is getting as input the light and view direction, and is telling

me how much of the incoming light is reflected along the given view direction

• BRDF defines the material behavior
• Having an accurate BRDF means being able to do a very accurate rendering

BRDF

• This is the usual notation when working with BRDF
• BRDF can return different values, but in ist most simple form it returns a scalar value for

each pixel RGB channel

BRDF

• Light is usually scattered more in some particular direction
•

If input light direction is kept fixed, BRDF tells the what percentage of the light is reflected
in what direction

BRDF

• Usually light is scattered along all this emisphere

BRDF

• What if I want the sum of all reflected light? Integrate over the empisphere!
• Given the definition of BRDF, what is the result of this integral?

BRDF

• A value equal to 1 means that the material does not absorb any energy.
• A value bigger than 1 means it is not a physical model, or that the material is also a

source of light

BRDF

• We typically represent BRDF with a curve

BRDF

• We typically represent BRDF with a curve

BRDF

• We typically represent BRDF with a curve
• The Shape changes when the incoming light direction changes

BRDF

• The BRDF function is a 4-dimensional function

BRDF

• Often when rendering we are not interested in all the values that the BRDF can produce,
but only on the particular value corresponding to a particular outgoing direction which
corresponds to my view vector

• For example, this is what we are trying to compute when doing shading!

BRDF

• Often when rendering we are not interested in all the values that the BRDF can produce,
but only on the particular value corresponding to a particular outgoing direction which
corresponds to my view vector

•

In some sense, the Phong/Blinn material models are non-energy-conserving BRDF!

BRDF

• Because of this interesting property, during rendering I can think about light going from

light source up to the camera, or I can work with rays starting from camera and reaching
the light source

BRDF

•

I am typically interested in calculating the quantity of light in that particular direction

BRDF

• The geometry term is scaling down the incoming light – technically, it accounts for

differential surface area of oblique angles

• Same concept we learned in Phong/Blinn models. But at that time it was included into

the material model; now we know that it is a geometry term independent of the material
properties

BRDF

• What happens when there are multiple light sources?
• By the same property announced last lesson, we add them!

BRDF

• What happens when there are multiple light sources?
• By the same property announced last lesson, we add them!

BRDF

In realistic environments, light is coming from every direction

•
• What happens to the summation?

The Rendering Equation

It becomes an integral over the entire emisphere!

•
• We have very good methods to compute these equation, which leads to very good light

simulation

The Rendering Equation

• Let's try to plot the Blinn/Phong "BRDF" shape
•
It is a very crude approximation of a true BRDF!
• The fact that Kd could be (1,1,1) means that the model is truly non-energy-conserving

Isotropic  vs Non-isotropic BRDF

• We can have non-isotropic BRDF

Non-isotropic BRDF example

Rendering algorithms
• We will talk about rendering algorithms in general, and then we will see why the rendering
equation fits in this framework
•
| Rendering algorithms | are about | generating | a raster | image |
| -------------------- | --------- | ---------- | -------- | ----- |

Rendering algorithms
• In particular, the first thing that a rendering algorithm must solve is: what triangle/part
correspond to what pixel?
• After the rendering algorithm has been applied, we can do things like shading etc

Rendering algorithms
• We will see different algorithms from the rasterization group
• The Ray Tracing group is formed by more correlated algorithms – the basic problem in Ray
tracing is solved by the Ray casting algorithm, all the other ones are way to solve the
rendering equation

Rasterization
• We have seen this step in the GPU pipeline! Automatically performed by the GPU for us
• Notice this low resolution triangle?We can do an additional step here to smooth the
aliasing effect

Rasterization
• Anti-aliasing!

Rasterization
• Anti-aliasing!
• Pixels have an interpolated color based on the percentage of triangle covered

Rasterization
• However, this is not the biggest issue that rasterization algorithms must solve
• The most foundamental issue is the visibility problem

Rasterization
• The visibility problem boils down to understanding which triangle is in front of which
triangle

Rasterization
• The visibility problem boils down to understanding which triangle is in front of which
triangle

Painter's algorithm

Painter's algorithm

Painter's algorithm

Painter's algorithm
• The painter's algorithm is first drawing the most far away objects and then moving to
closer and closer objects, eventually painting over the previous ones

Painter's algorithm
• The painter's algorithm is first drawing the most far away objects and then moving to
closer and closer objects, eventually painting over the previous ones

Painter's algorithm
• The painter's algorithm is first drawing the most far away objects and then moving to
closer and closer objects, eventually painting over the previous ones

Painter's algorithm
• The painter's algorithm is first drawing the most far away objects and then moving to
closer and closer objects, eventually painting over the previous ones

Painter's algorithm
• How to apply the Painter's algorithm?

Painter's algorithm
• How to apply the Painter's algorithm? I need to sort the triangles!

Painter's algorithm
• The problem is that sometime it is difficult to define that sorting... :-(

Painter's algorithm
• The painter's algorithm is unable to produce such output – it either picks one triangle or
the other one

Painter's algorithm limitations

Z buffer Rasterization
• Most popular rasterization algorithm on Earth!
• All GPU use that algorithm

Z buffer Rasterization
• It works by storing the depth value at each pixel
• It is called the z value because x and y are the screen coordinates, and z points to you :)

Z buffer Rasterization
• By comparing z values of both triangles at each point, it is able to understand which pixel
should be displayed
• No need to sort triangles anymore!
• It handles triangles overlap!
• It sometime requires to do multiple shading even if only one pixel will be displayed

Z buffer Rasterization
• Z buffer rasterization can also do anti-aliasing as well
• This is actually hard to do, but there is an easier way to obtain that result

Super Sampling Anti-Aliasing (SSAA)
• It consists in sampling with more points than the actual pixels
• Usually 4,8,16 points per pixel

Super Sampling Anti-Aliasing (SSAA)
• It consists in sampling with more points than the actual pixels
• Usually 4,8,16 points per pixel
• It is in some sort similar to rendering at a much higher resolution and then downsampling
• Expensive operation – a lot of data to store, and I need shading for each additional point!

Multi Sample Anti-Aliasing (SSAA)
• The idea behind MSAA is that one RGBA value per pixel is enough, while the depth needs
to be sampled more densely!
• Significantly cheaper than SSAA

Z-buffer limitations
• Z-buffer cannot handle correctly transparency effects –
• It is a problem that we need to deal with, for example by triangle ordering

Z-buffer limitations
• If I first draw my usual triangle, and then...

Z-buffer limitations
• ...the trasparent triangle, I am fine!

Z-buffer limitations
• If I first draw the transparent triangle...

Z-buffer limitations
• … I am screwed!

Z-buffer limitations

A-buffer rasterization
• A-buffer rasterization is pretty close to Z-buffer rasterization – but it supports order-
independent transparency
• It is more costly
• Used in offline rendering
• It can do very high quality antialiasing, and very cheapy too!

A-buffer rasterization
• It stores a linked list of each fragment produced by the corresponding triangle
• This enable the the dealing of transparent triangles as well as an easy anti-aliasing effect

REYES

REYES
• Back in those days('80) a lot of different data structures were used – bezier patches,
NURB surfaces, etc
• The idea were to divide each surface in smaller and smaller pieces, until...

REYES
• Back in those days('80) a lot of different data structures were used – bezier patches,
NURB surfaces, etc
• ...until reaching sub-pixel sizes! (micropolygons)
• Then, you can figure out everything by working on sub-pixels operations

REYES
• It is very costly and unsuitable for real-time rendering on GPU, but it is still used
nowadays in offline-rendering!

REYES
• Today is used a lot in conjunction with ray tracing!

Rasterization vs Ray tracing

Rasterization vs Ray tracing
• It seems like doing the backward process w.r.t. rasterization!

Rasterization procedure

Rasterization procedure

Ray Tracing procedure
• In the case of Ray Tracing, I use all the triangles at once
• Don't even need to do projection transformation!
• I just need the pixel location in the 3D space, and then I can cast a ray up to a primitive hit

Ray Tracing procedure
• Dealing with transparency is so trivial with Ray tracing!

Ray Tracing procedure
• In order to form the image, I need to repeat the same procedure for each pixel
• Can sample more than one point per pixel, in order to apply anti-aliasing effects
• However, those are not the reasons why Ray Tracing is so powerful..

Ray Tracing procedure
• The true power of Ray Tracing lies in the ability to do super accurate shading
• It is the standard-de-facto when doing offline rendering
• It is impossible to reach the same accuracy with rasterization techniques

Ray Tracing procedure
• The rays starting from the camera are called primary rays
• All the other ones are called secondary rays

Ray Tracing procedure
• Secondary rays are used to do shading, and in general to deal with reflections!

Ray Tracing procedure
• This is an example of what can be accomplished with Ray Tracing
• You can't do this with any rasterization algorithm!

Ray Tracing procedure
• Ray Tracing special effects are not limited to reflections
• With Ray Tracing we can solve the rendering equation!

Rasterization vs Ray tracing
• If Ray Tracing is so powerful, why are we still using rasterization and z-buffer and shading?
• Rasterization is still ubiquitous because it is FAST. Ray Tracing is SLOW

Rasterization vs Ray tracing
• The first difference in performance lies into the use of the primitives

Rasterization vs Ray tracing
• The first difference in performance lies into the use of the primitives
• The second difference in performance lies into the different data access!

Rasterization vs Ray tracing
• To speed up the access to each primitive, with Ray Tracing we build some special data
structure – like a binary search tree, to accelerate the thing

Rasterization vs Ray tracing
• To speed up the access to each primitive, with Ray Tracing we build some special data
structure – like a binary search tree, to accelerate the thing
• In this way, while rasterization has linear complexity with respect to the number of
primitives, Ray Tracing has logarithmic complexity
• At some point, Ray Tracing will become more performant...or at least we hope so :)

Rasterization examples

Rasterization examples

Rasterization + Ray Tracing
• As rasterization has only primary rays effects, while the power of Ray Tracing lies into
secondary rays effects, we can combine the two techniques to get the best of both
worlds
• However, it turns out that most of the rendering time is spent in the secondary effects, so
the speedup given by the rasterization part is almost negligible

Rasterization + Ray Tracing
• In our project, we will do Ray Tracing on the GPU via software (on the fragment shader!)Ray Tracing
• In its most basic form, Ray Tracing consists in firing a ray from the camera to the pixel up
to the first primitive it hits
• The primitive point color will then be the pixel color

Ray
• For the purposes of Computer Graphics, a ray is defined by a position and a direction

Ray
• For the purposes of Computer Graphics, a ray is defined by a position and a direction
• Any point along this half-line can be represented as a combination of the ray origin point
and direction

Ray
• It can be interpreted as "starting from p, and moving along d with magnitude t"
• t can be also thought as the distance between p and x iff d is a unit vector
• t must be positive to move in "front of the ray"

Ray
• If t is negative, we ara "behind the ray" or "backside of the ray"
• Most of the times we are interested in positive t values

Ray intersections
• What I have to do is to check if this ray has an intersection with a primitive

Ray intersections
• Implicit surfaces are very hard to rasterize, but with Ray Tracing is easy to check for
intersections

Ray intersections
• Implicit surfaces are very hard to rasterize, but with Ray Tracing is easy to check for
intersections

Ray intersections
• Implicit surfaces are very hard to rasterize, but with Ray Tracing is easy to check for
intersections

Ray intersections
• Implicit surfaces are very hard to rasterize, but with Ray Tracing is easy to check for
intersections
• However, implicit surface equations can be pretty complicated, so finding the t values
that solve those equations can be a non trivial task

Ray-sphere intersection
• Those are the formulas representing a sphere centered on the origin

Ray-sphere intersection
• This assumes that the sphere centre is at coordinate c

Ray-sphere intersection
• This assumes that the sphere centre is at coordinate c

Ray-sphere intersection
• This is what I get after substitution – a quadratic polynomial as function of t
• There are two possible t values which satisfy this equation, which makes perfect sense :)

Ray-sphere intersection

Ray-sphere intersection
• The upper solution is the correct one as it produces the smallest t value, which means is
the intersection nearer the camera
• With t I can easily calculate point x, and then knowing the centre c I can calculate the
normal vector at point x

Ray-plane intersection
• Same idea of before

Ray-plane intersection
• Very easy to calculate t, but does the ray always intersect the plane?
• There is just one case where there is no intersection: when the ray and the plane are
parallel!
• Just check that the dot product of d by n is not zero :)

Ray-plane intersection
• If the plane normal align with an axis, the formula simplifies like this

Ray-triangle intersection
• The most frequent case
• Very expensive operation
• There are several ways to check for triangle intersection

Ray-triangle intersection
• The most popular method is to build the corresponding plane, and check for intersection
with that plane
• After that, I need to check if the intersection point is inside the triangle!
• Did someone said barycentric coordinates ? :-)

Ray-triangle intersection

Ray-triangle intersection
• The most optimized version use just one division operation and just at the end of the
algorithm

Ray-Tracing
• The only issue to solve here is to find the closest primitive

Ray-Tracing

Ray-Tracing
• Like in the z-buffer mechanism, I will keep track of the closest hit so far
• After looping on all the primitive, I will get the closest hit of the scene
• We could have a huge amount of primitives. Is there a faster way to do this?

Ray-Tracing Acceleration
• Lets imagine there are million of spheres, so that the brute force approach is unfeasible

Ray-Tracing Acceleration
• Knowing where my spheres are, I can make a bounding box around them
• If the ray does not intersect the box, then it does not intersect any of those spheres!
• Making Axis-aligned Bounding Box means checking six axis-aligned planes!

Ray-Tracing Acceleration
• The way to do that bounding box check is the main task of the next project :)
• However, if I just make one bounding box, then if there is intersection I still need to check
intersection with all the spheres!

Ray-Tracing Acceleration
• However, if I just make one bounding box, then if there is intersection I
still need to check intersection with all the spheres!
• I can do even better than this!Lets check the bigger box, and if there is intersection, lets
check the inner smaller boxes

Bounding Volume Hierarchy (BVH)
• Almost everyone nowadays uses this structure: a hierarchy of bounding boxes!
• It starts with a box containing all the scene. If there is no intersection, I go with next ray

Bounding Volume Hierarchy (BVH)
• If there is intersection, I check the inner boxes

Bounding Volume Hierarchy (BVH)
• If there is intersection, I check the inner boxes
• If there is no intersection with any of them, I go checking the next ray

Bounding Volume Hierarchy (BVH)
• If there is intersection, I check the inner boxes

Bounding Volume Hierarchy (BVH)
• The BVH structure is similar to a binary tree (except that it can also be non-binary)
• The leaf nodes will contain our primitive!

Bounding Volume Hierarchy (BVH)
• The details on how to efficiently make those boxes is behind the scopes of this course
• A good bounding box hierarchy will greatly reduce the amount of ray-triangle intersection checks

GPU Ray Tracing – Hardware Acceleration
• In modern GPUs, together with Rasterization-specialized hardware there is also some
Ray Tracing specialized hardware as well!

GPU Ray Tracing – Hardware Acceleration
• In modern GPUs, together with Rasterization-specialized hardware there is also some
Ray Tracing specialized hardware as well!
• More complicated machinery, but it performs a lot of things

GPU Ray Tracing – Hardware Acceleration
• Unfortunately, it is not supported by WebGL
• However, we can do software Ray Tracing :)

Software Ray Tracing
• Sofware Ray Tracing is a decade-old technology of Ray Tracing solutions
• Extensively used by film makers, CAD users, etc for photorealistic renderings
• This is how the project about Ray Tracing will be based on!

Software Ray Tracing
• The issue is that we have a rasterization-based pipeline, while we wanna do Ray Tracing
instead!
• What I need is some shader to run on each pixel! And on each shader run I will implement
my software Ray Tracing code!

Software Ray Tracing
• In the Vertex Shader I will render a quad covering the full screen
•
With this trick, thanks to the vertices interpolations in the Fragment Shader I will have a
| separate shader | run for each | screen pixel! |
| --------------- | ------------ | ------------- |

Software Ray Tracing
• Most of this code will be already implemented in the project template
• However, there is also another possible approach – rasterization plus ray tracing!

Software Ray Tracing
• I can solve primary visibility task with the usual rasterization pipeline, and then just
compute the secondary rays with Ray Tracing, to add reflections, shadows, etc

Software Ray Tracing
• In this case, my Ray Tracing will start from the primitive point
• In the project there will be two modes: one which will be full Ray Tracing, and the other
that will be rasterization + Ray TracingShadows
• What do we mean for shadows in Computer Graphics?

Shadows
• This is a shadow!
• The shadow is the absence of light in the presence of some light ;-)

Shadows
• Shadows are very important to perceive the objects location as well as to perceive depth

Shadows
•
| A point is in shadow | if there is no | direct light visibility |
| -------------------- | -------------- | ----------------------- |
•
This is exactly what we are going to do in the project with ray tracing :)

Ray Traced Shadows
• From a point hit by the primary ray, we fire another ray called shadow ray
• If the shadow ray intersect an object while hitting the light source, then the corresponding
point is in shadow
• It seems very straightforward to implement, but..

Ray Traced Shadows
• If you implement it in this way, you would get this effect!

Ray Traced Shadows
• This is what we think it is happening, but if we zoom on the surface....

Ray Traced Shadows
• Due to the lack of precision,we find rounding errors which can add to the true surface
point an offset!
• Those errors are coming not only from the point representation, but also from all
the rounding errors performed along all the computation

Ray Traced Shadows
• Due to those errors, on average half of the points will be above the surface, which is fine,
but other half will be below the surface and so the corresponding shadow rays will hit the
surface!

Ray Traced Shadows
• The most intuitive solution – ignore the surface! - could work just in some cases: if the
surface is concave then it should correctly shadow itself
• It is also a clunky solution

Ray Traced Shadows
• The best solution: start counting for intersections not from point p, but slightly more
along the ray
• This corresponds to add a bias value
• The bias is scene-dependent, and should be set not too much big, not too much small

Ray Traced Shadows
• The best solution: start counting for intersections not from point p, but slightly more
along the ray
• This corresponds to add a bias value

Ray Traced Shadows
• Instead of doing this

Ray Traced Shadows
•
We are going to do this
•
| The bias   | is scene-dependent, will often be set by |         |      |          |          | the user,  |
| ---------- | ---------------------------------------- | ------- | ---- | -------- | -------- | ---------- |
| and should | be set                                   | not too | much | big, not | too much | small      |

Ray Traced Shadows
• Solved that issue, we can use shadow rays to calculate shadows
• It can be used in a full Ray Tracing setting, or it can be used after rasterization step

Ray Traced Shadows
• However: could I compute shadows without the use of Ray Tracing at all?

Rasterization
• The rasterization pipeline doesn't help us at all for calculating shadows

Shadow mapping
• Very popular technique, even more popular that Ray-Tracing shadows
• The idea is: if the light source cannot see the point, then it is in shadows

Shadow mapping
• To check if the light source can see the point, I put a second camera on the light source!
• Then, in order to understand if a point is in shadow, I have to find it on the second camera
image. If I cannot see it, then it is in shadows!

Shadow mapping
• I don't need a full RGB image for the second camera; I just need a depth map (also called
a shadow map)
• Through transformations I take the point on the first image, map it to the second one, and
check the distance value – if it is shorter than expected, the point is in shadows

Shadow mapping
• More info at https://roblouie.com/article/1034/webgl-shadow-maps-part-1-as-
simple-as-possible/
• Shadow mapping has some drawbacks: I need to render a (high resolution) shadow map
before rendering the main image (for each light source!)

Shadow mapping
• Morever, it only works on point-like and direction light sources
• However, computing shadow map is FAST – no need to re-compute if lights/objects do not
move
• Ray-Tracing shadows are more accurate

Shadow mapping
• Morever, it only works on point-like and direction light sources
• However, computing shadow map is FAST – no need to re-compute if lights/objects do not
move
• Ray-Tracing shadows are more accurate

Reflections
• In this context, with reflections we are not talking about reflection of light, but instead
reflection of an object to another object

Reflections
• We focused on light coming from light sources, but in reality a big role is played by light
coming from other objects as well!
• This is the concept of global illumination

Reflections
• We focused on light coming from light sources, but in reality a big role is played by light
coming from other objects as well!
• This is the concept of global illumination
• The rendering equation is made for accounting all those light contributions

Reflections
• However, with reflections we are interested in a specific effect: the reflection of an object
light on a mirror-like surface

"perfect" Specular Reflections of Objects
• However, with reflections we are interested in a specific effect: the reflection of an object
light on a mirror-like surface

"imperfect" Specular Reflections of Objects
• This other case, which is even more realistic, is more difficult to render

"perfect" Specular Reflections of Objects
• This is the specular reflection of light in the context of the rendering equation

"perfect" Specular Reflections of Objects
• This is the specular reflection of an object in the context of the rendering equation
• The second equation comes from the same reasoning done with reflection of light

"perfect" Specular Reflections of Objects
• As the perfect specular reflection does not produce any diffuse part, it has a very
simplified representation
• K is usually set to the specular coefficient of the surface K , but it is often customizable
r s
• How to compute L ?

"perfect" Specular Reflections of Objects
• What I need to do is to calculate Lr by tracing the reflection ray
• As the ray will hit a surface in some point, I need to find the reflected light at this point
• How to do this? Let's do shading at this point!

"perfect" Specular Reflections of Objects
• The same procedure can be repeated again for a reflection of a reflection!

"perfect" Specular Reflections of Objects
• This bouncing procedure can be repeated at infinity! We will choose to stop after a finite
amount of iterations

"perfect" Specular Reflections of Objects
• The procedure could be implemented in a recursive way! Unfortunately, WebGL does not
support recursive functions :-( However, we can represent this recursive function in an
iterative way :-)

Examples

Examples

Examples

Examples

Examples

Examples

Refractions
• Same idea of reflections, just a bit more complicated because you must take into
account the refraction index of the material

Refractions

Ray types

Ray types

Ray types
• This second difference could be a source of bugs: you must check every primitive along
the trace to assure that you find the closest hit

Ray types
• Instead, as soon as I hit a primitive with a Shadow rays, I am done!

Ray types
• Another difference is: with Reflection/Refraction Rays, I need to record the hit
information! With Shadow Rays, I don't need to record any information at all!
• For this reason, most ray tracer softwares implement separate routinesSampling

• This was an incredible result for that time being

Sampling

• This was the typical computer available at that time – 48kb of memory!

Sampling

• This was the videogame created one year later

Sampling

• This was one of the best CGI available at that time

Whitted-Style Ray Tracing

• Whitted-Style Ray Tracing is the model we have used in the past lessons!

Cook-Style Ray Tracing

• Shadows, imperfect reflections, motion blur

The Rendering Equation  - Path Tracing

Path Tracing

• Path Tracing is still the most used Ray Tracing algorithm, beside few tweaks

Whitted-Style Ray Tracing

• So, how to move from this simple Ray Tracing technique to more advanced ones like Path

Tracing?

• We need to cast this algorithm in the Rendering Equation framework

The Rendering Equation

• To recap: the Rendering Equation is an integral over an emisphere placed over a point that

we are shading

• Over the emisphere we are looking for light coming from all directions, multiplied by the

geometry term and by BRDF. This light represents the light going to the camera

The Rendering Equation

• However, we need to take into account the fact that light can come from two different entities
• For this reason, we typically calculate those two contributions differently
• We already calculated the contribution from direct illumination – but what about indirect

illumination?

The Rendering Equation

•

It makes sense to separate the integral in two components

The Rendering Equation

It makes sense to separate the integral in two components

•
• As we have a finite number of light sources, the first integral becomes a sum

Whitted-Style Ray Tracing

• With Whitted-Style Ray Tracing, we solve the indirect illumination calculation by doing the

following semplifications:
o We assume that the BRDF is the Blinn/Phong model
o We assume that the diffuse term is zero → Kdis zero/black. Diffuse reflection does not happen

for indirect illumination (but can happen for direct illumination)

Whitted-Style Ray Tracing

• With Whitted-Style Ray Tracing, we solve the indirect illumination calculation by doing the

following semplifications:
o We assume that the BRDF is the Blinn/Phong model
o We assume that the diffuse term is zero → Kdis zero/black. Diffuse reflection does not happen

for indirect illumination (but can happen for direct illumination)

o We assume that we have a perfect flat surface → alpha is infinity. This means that the cosine term is

zero unless the ωi  / ωo are the perfect reflection direction!

Whitted-Style Ray Tracing

• Substituting this BRDF into the integral produces futher simplifications, as it doesn't

matter looking at every direction in the integral – just one direction produces an output!

Whitted-Style Ray Tracing

• Substituting this BRDF into the integral produces futher simplifications, as it doesn't

matter looking at every direction in the integral – just one direction produces an output!

Whitted-Style Ray Tracing

• This is what we got last lesson!
• You can think about Whitted-Style Ray Tracing as the simplification of the BRDF when

computing the indirect illumination term

Sampling

• Now we are back to the original question – how to solve that integral without strong

simplifications?

• The answer is: by doing sampling

Sampling

•

In order to understand sampling, lets assume we would like to render those two triangles

Sampling

In order to understand sampling, lets assume we would like to render those two triangles

•
• Low resolution rendering
• Strong aliasing

Sampling

• The right image is way better than the left one

Sampling

• By zooming on one pixel, we have a situation like this. But we still have to find one color

for the entire pixel

Sampling

• By zooming on one pixel, we have a situation like this. But we still have to find one color

for the entire pixel
• How to compute this?

Sampling

• Lets assume we have a f(x) function continuously defined over the pixel

Sampling

• Lets assume we have a f(x) function continuously defined over the pixel

Sampling

• Lets assume we have a f(x) function continuously defined over the pixel

Sampling

• Lets assume we have a f(x) function continuously defined over the pixel

Sampling

If I calculate this integral, I would get the best pixel color value!

•
• The problem is, I often do not have a precise definition of f(x), and even if I have it, it could
be a non trivial function so that the analytical calculation of this continous integral is hard

• Solution: we can compute this integral numerically by sampling

Sampling

If I calculate this integral, I would get the best pixel color value!

•
• The problem is, I often do not have a precise definition of f(x), and even if I have it, it could
be a non trivial function so that the analytical calculation of this continous integral is hard

• Solution: we can compute this integral numerically by sampling

Sampling

• By counting the number of points equal to white and blue respectively, I can come up

with a good pixel value approximation

• As the number of samples goes to infinity, I get the correct pixel value
• There is still a problem with this sampling formulation

Sampling

• Lets see which color we get if more and more points are covered in blue with this sort of

alignment

Sampling

• Lets see which color we get if more and more points are covered in blue with this sort of

alignment

Sampling

• Lets see which color we get if more and more points are covered in blue with this sort of

alignment

Sampling

• Lets see which color we get if more and more points are covered in blue with this sort of

alignment

Sampling

• Lets see which color we get if more and more points are covered in blue with this sort of

alignment

Sampling

• Despite sampling 64 times, I am getting only 8 possible shades of blue as outcome!

Sampling

• As I am using 64 samples, I should be able to get 64 different possible shades of blue!

Sampling

• Solution:  by changing the sampling strategy (a slight rotation) now I get 64 shades of

blue!

Sampling

• But if by chance my triangle edges align with my sampling strategy, I get back the same

issue :-(

• The problem lies into my sampling strategy having a pattern. Ideally,

I don't wanna have a pattern in my sampling strategy at all!

Monte Carlo Sampling

• Very popular technique
• How to get an effective random sampling is a very big and active topic of research

The Rendering Equation

• The idea is to replace this difficult integral with Monte Carlo sampling!

Monte Carlo Ray Tracing

• The idea is to replace this difficult integral with Monte Carlo sampling!
• The task is to estimate the incoming light for all the direction

Monte Carlo Ray Tracing

• To approximate the integral, I am going to take N randomly generated directions and

average them

• The formula is incomplete

Monte Carlo Ray Tracing

•

•

In case of a perfect diffuse material would make sense to sample uniformly, but what
about a mirror-like surface? We should add more samples in the perfect specular
direction and less samples in other directions!
In practice the BRDF must be considered in order to choose the sampling strategy

Monte Carlo Ray Tracing

• With Monte Carlo Ray Tracing we can produce imperfect reflections

Monte Carlo Ray Tracing

Whitted Style Ray Tracing

Monte Carlo Ray Tracing

• Soft shadows can be calculated with Monte Carlo Ray Tracing as well
• This image still miss indirect light illumination

Monte Carlo Ray Tracing

• This image has  indirect illumination calculations thanks to a particular type of Monte

Carlo Ray Tracing: Path Tracing

Monte Carlo Ray Tracing

• As I need to send multiple rays for each light bounce, the number of total rays grow

exponentially!

Path Tracing

• A single ray will eventually hits a light source, but it could also not hit a light source

(within a fixed number of bounces)

Path Tracing

• A single ray will eventually hits a light source, but it could also not hit a light source

(within a fixed number of bounces)

• But by firing N samples, and by checking how many of them reach a light source, I can

make a pretty good estimation (if N is high enough!)

Path Tracing

• Path Tracing produces very noisy renderings if the number of rays are low!

Path Tracing

• Path Tracing produces very noisy renderings if the number of rays are low!

Path Tracing

• Path Tracing produces very noisy renderings if the number of rays are low!

Path Tracing

• The noise reduces kind of a linearly while I exponentially add more rays!

Denoising

• However, I can use Path Tracing up to a reasonable amount of rays, and then I

can denoise the image with a denoiser

Denoising

• However, I can use Path Tracing up to a reasonable amount of rays, and then I

can denoise the image with a denoiser

Video
• A video is nothing more than a sequence of raster images (frames!)

Video

Video

Video

Video
• The displaying of frames one quickly after the other gives the illusion of animation

Frames Per Second (FPS)
•
How many frames per second should I display to give this illusion?
| • There     | are some | standards: |
| ----------- | -------- | ---------- |
| o BroadCast |          | TV         |
• 30 FPS - NTSC
•
25 FPS – PAL

Frames Per Second (FPS)
• How many frames per second should I display to give this illusion?
• There are some standards:
o BroadCast TV
• 30 FPS - NTSC
• 25 FPS – PAL
o Movies
• 24 FPS – Standard
• 48 to 120 FPS – High Frame Rate

Frames Per Second (FPS)
• How many frames per second should I display to give this illusion?
• There are some standards:
o BroadCast TV
• 30 FPS - NTSC
• 25 FPS – PAL
o Movies
• 24 FPS – Standard
• 48 to 120 FPS – High Frame Rate
o Monitors
• 60/120 Hz (Hz=1/sec, Hz = 1 FPS)

Frames Per Second (FPS)
• How many frames per second should I display to give this illusion?
| • There | are some | standards: |
| ------- | -------- | ---------- |
| BroadCast |     | TV  |
| --------- | --- | --- |
• 30 FPS - NTSC
•
25 FPS – PAL
| o Movies |     |     |
| -------- | --- | --- |
•
24 FPS – Standard
• 48 to 120 FPS – High Frame Rate
| o Monitors |     |     |
| ---------- | --- | --- |
• 60/120 Hz (Hz=1/sec,  Hz = 1 FPS)
| o VideoGames |                |     |
| ------------ | -------------- | --- |
|              | • 60 to 120fps |     |

Video Resolution
• Aspect ratio is the ratio of width and height

Video Resolution
• Aspect ratio is the ratio of width and height

Video Resolution
• More recent aspect ratio, closed to the one used in movies

Video Resolution
• More recent aspect ratio, closed to the one used in movies

Video Resolution
• More recent aspect ratio, closed to the one used in movies

Video Resolution
• More recent aspect ratio, closed to the one used in movies

Video Resolution
• More recent aspect ratio, closed to the one used in movies

Video Resolution
• More recent aspect ratio, closed to the one used in movies

Video Resolution comparison

Video Data
• RGB
o 8 bit per channel, equal to 3 bytes per pixel

Video Data
• RGB
o 8 bit per channel, equal to 3 bytes per pixel
• 720p
o 1280x720 = 921600 pixels
o ~2.8 MB per frame

Video Data
• RGB
o 8 bit per channel, equal to 3 bytes per pixel
• 720p
o 1280x720 = 921600 pixels
o ~2.8 MB per frame
• 30 fps
o ~83 MB per sec
o ~664 Mbits per sec

Video Data
• RGB
o 8 bit per channel, equal to 3 bytes per pixel
• 1080p
o 1920x1080 = ~2.1M pixels
o ~6.2 MB per frame
• 30 fps
o ~186 MB per sec
o ~1.5Gbits per sec
• How do we get such streaming data on our internet connection?
• The answer is Video Compression

Video Data
• RGB
o 8 bit per channel, equal to 3 bytes per pixel
• 1080p
o 1920x1080 = ~2.1M pixels
o ~6.2 MB per frame
• 30 fps
o ~186 MB per sec
o ~1.5Gbits per sec
• How do we get such streaming data on our internet connection?
• The answer is Video Compression

Video Compression
• First of all, we can compress each frame, in order to avoid sending raw data
• However, we notice that the image does not change a lot from one frame to the next one..

Video Compression
• We leverage information from previous frames to store only the changes in subsequent
frames
• This led to Video Compression formats, e.g. MPEG-4 (H.264)

Video Compression
• We leverage information from previous frames to store only the changes in subsequent
frames
• This led to Video Compression formats, e.g. MPEG-4 (H.264)
• At visualization time, we decode the data to display the frames

Animation

Animation

| How to | specify | animation? |
| ------ | ------- | ---------- |

Procedural Animation
• Transformation
• In its most basic form, it is a mathematical formulation that explain how the object
should transform and/or deform

Procedural Animation
• Deformation
• It can be simple or rather complicated

Procedural Animation
• Deformation
• It can be simple or rather complicated

Procedural Animation
• Flocking
• "The Flocking Algorithm is a computational model inspired by collective behavior observed in
nature, such as birds flying in formations or fish swimming in schools. It simulates emergent
behavior in groups of entities by applying three principles: alignment, cohesion, and separation."

Keyframing
• Very popular technique in Computer Graphics
• The idea is to use some key frames which are defined by an user, and then to generate
some in-between frames, called tweens

Keyframing
• The idea is to use some key frames which are defined by an user, and then to generate
some in-between frames, called tweens

Keyframing
• X1 and x2 represents a set of points

Keyframing
• Vanilla solution would be a simple linear interpolation

Keyframing
• This variation produces a smoother transition

Keyframing
• This variation produces a smoother transition

Keyframing
• This variation produces a smoother transition

Keyframing
• The change between one frame and the other is smoother, but the overall animation is
still piecewise linear!

Keyframing
• I need a curve like this one in order to make a smooth animation
• Just one example among a lot of different techniques

Keyframing
• In general, in keyframing techniques we specify the times and the type of interpolation
• Still, the most consuming process is generating the different keyframes

Keyframing
• The keyframes can be generated with some techniques like Morphing

Keyframing
•
The nice property of morphing is that I can calculate the tween frames just by
| interpolating the | underlying | morphing | variables |
| ----------------- | ---------- | -------- | --------- |

Keyframing
•
The nice property of morphing is that I can calculate the tween frames just by
| interpolating the                | underlying | morphing            | variables |
| -------------------------------- | ---------- | ------------------- | --------- |
| • It is not that useful to model |            | human/animal bodies |           |

Keyframing
• It works by defining the scheleton of the body, and then by defining how the surface
should deform while the skeleton is animated
• The skeleton is tipically defined by joints and bones, and the animation is defined by
rotating the joints

Keyframing
• It can use forward and inverse kinematics

Keyframing
• It can use forward and inverse kinematics
• The number of bones and joints define the complexity and the realism of the animation

Keyframing
• It can use forward and inverse kinematics
• The number of bones and joints define the complexity and the realism of the animation
• Often some high level controls are defined to rotate more than one joint (rigging)

Keyframing
• How should one middle vertex change?
• A weighing factor for each involved joint is tipically used

Keyframing
• Cool example of rigging

Motion Capture
• With this technique I don't have to specify keyframes at all!
• It is still an estimation of the actual bones motion

Motion Capture
• It is not a flawless technique and it still needs filtering and adjustments to make it works
• Still, it is a very popular technique thanks to the final obtained realism

Motion Capture
• Other tools can be used to capture facial movements

Motion Capture
• Often used in movies

Physics-Based Animation
• In this technique, some physics laws are simulated in order to get a realistic animation

Combined techniques
• Techniques can be combined together to get results like thisPhysics-based Animation
• The easiest physics- based animation system is the mass-spring system

Physics-based Animation
• Those are the ball positions I should get at each time step

Physics-based Animation
• Those are the ball positions I should get at each time step
• I will track velocity as well

Physics-based Animation
• Position and velocity will form my simulation state

Physics-based Animation
• Position and velocity will form my simulation state

Simulation step
• Pretty much every simulation is working in this way

Newton's 1st Law of Motion

Newton's 1st Law of Motion

Newton's 2nd Law of Motion

Newton's 2nd Law of Motion

Newton's 2nd Law of Motion

Newton's 2nd Law of Motion
• The possibility of solving those integrals in closed form depends on how F(t) is varying
• In most of the cases we are going to estimate those integrals through numerical integration

Explicit Euler Integration
• Euler Integration is the easiest form of numerical integration
• It assumes that the force (*acceleration) and the velocity are constants
• The error by step caused by this assumption is proportional to the square of the time step
Δt
• it is fine error for small

Implicit Euler Integration
• This implicit formulation is substracting energy to the system, leading to a more stable
numerical integration
• However, it produces an ill-defined situation which can be difficult to solve

Semi-Implicit Euler Integration
• This solves every problem because F(t) can be now easily computed, and then the third
| row formula | can be easily | computed | as well! |
| ----------- | ------------- | -------- | -------- |
• In practice is stable as implicit technique, and it does not introduce or reduce energy!

Gravity Force
| • Easiest | example of | force to calculate |
| --------- | ---------- | ------------------ |

Linear Spring Force
• The spring produces a force proportional to the difference of actual length versus rest
length
• The direction of that force depends on if the spring is compressed or expanded

Linear Spring Force
• The spring produces a force proportional to the difference of actual length versus rest
length
• The direction of that force depends on if the spring is compressed or expanded

Linear Spring Force
• This would be the result if no other forces (e.g. gravity) are applied
• Problem is, this movement never ends!

Spring Damping Force
• This force will be proportional to the length change speed

Example of use of mass-spring system

Mass-spring systems
• Even if represented here as spheres, the masses will be considered as points in our simulations
• This is a popular choice in many simulations in computer graphics

Mass-spring systems
• In general, we will refer to particles
• Particles are used a lot in computer animation (e.g. fluids, explosions)

Mass-spring systems
• My system is described by positions and velocities of the particles
• Given position and velocity, I can easily calculate the spring force

Mass-spring systems
• My system is described by positions and velocities of the particles
• Given position and velocity, I can easily calculate the spring force

Mass-spring systems
• The force on the second particle is equal to the first one, with a minus sign

Mass-spring systems
• The dot product by d vector is performed to eliminate any contribution on other directions

Mass-spring systems

Simulation
• This is the general pipeline

Simulation (JavaScript)
• This is the general pipeline (in JavaScript)

Simulation step

Simulation step (Semi-implicit Euler Integration)
• This is tipically done in practice

Simulation step (Explicit Euler Integration)
• This is tipically done in practice

Force Computation

Collisions
• It is a simple concept which often requires complex solutions
• In the final homework the solution will be rather simple

Collisions
• This situation is rather lucky

Collisions
• This situation is what actually could happen

Collisions
• ...or this situation as well!

Collisions
• ...or this situation as well!

Collisions
• This is the simplest situation

Collisions
• r is a coefficient which represents how much energy is returned after the "bounce"

Collisions
• A similar reasoning is performed on velocities as well
• If we are not interested in this realistic collision handling, we can just do position
correctionSimulation in Computer Graphics
• A brief investigation on most popular simulations in Computer Graphics

Simulation in Computer Graphics

Rigid Body Simulation

Rigid Body Simulation
• The concept of rigid body simulation is not new
• The added complexity is about rotations

Rigid Body Simulation
• The concept of rigid body simulation is not new
• The added complexity is about rotations

Rigid Body Simulation
• To get a realistic rigid body simulation, we should compute the point of collision and the torque
• However, it is usually based on inpulse-based collision
• The inpulse directly modify the velocity (and the rotation)

Rigid Body Simulation
• Another issue is with multiple collision points

Rigid Body Simulation
• This can be solved by defining a rest in contact state

Rigid Body Simulation
• Simulation needs to keep track of stacks like this, to avoid issues

Articulated Rigid Body Simulation
• It is made of two rigid bodies connected by a constraint (joint)

Articulated Rigid Body Simulation
• The presence of the joint heavily affects the number of actual DOF

Articulated Rigid Body Simulation
• The presence of the joint heavily affects the number of actual DOF

Articulated Rigid Body Simulation
• Possible applications

Articulated Rigid Body Simulation
• Possible applications
• They can be simulated in two ways:
with additional forces which keeps the rigid bodies together, or with hard constraints,
which actually remove the DOF

Deformable Simulation

Finite Element Method
• FEM is one of the techniques that can be used to simulate deformable objects

Finite Element Method
• FEM is one of the techniques that can be used to simulate deformable objects
•
| It is like | triangulation | but in 3D |
| ---------- | ------------- | --------- |

Finite Element Method
• Point-like structures connected with triangles instead of springs
• The deformed shape tries to recover ist rest shape by applying some forces

FEM vs mass-spring simulation
• Both can be used to simulate deformable objects, although FEM is more accurate
• There are still some particular simulations where mass-spring system is pretty nice

Mass-Spring Fracture Simulation
• In this simulation the mass-spring systems will break upon reaching some tension
(Peridynamics)

Mass-Spring Cloth Simulation
• Simulating a cloth requires a different mass-spring setup
• For clothes there is an even better formulation

Mass-Spring Cloth Simulation
• Here each mass is applied to a vertex in the mesh, and masses are connected with
different formulas w.r.t. mass-spring systems

Cloth simulation example

Spoiler from the future: cloth sim on three.js
• You can take inspiration from this for your (high level) simulation

Particle-based Fluid simulation
• Particles are interacting each other by following some physical laws (Lagrangian fluid simulation)
• Usually the point-like particles are then wrapped with triangular meshes

Smoothed Particle Hydrodynamics
• The forces are computed through Navier-Stokes Equations
• It is not an hard simulation in theory, but in practice there are several issues to solve...

Grid-based Fluid Simulation
• Different approach, which directly solves the Navier-Stokes differential equations
• A domain is partitioned in small cells, where the Navier-Stokes are applied

Grid-based Fluid Simulation
• This equation, which holds for uncompressible fluids, states that the amount of fluid
which enters the volume is equal to the amount of fluid which exits the volume!

Grid-based Fluid Simulation
• Useful to simulate also smokes and gases!

Hybrid Fluid Simulation
• Grid methods are realistic but have issues on "losing" mass and volumes
• They can be combined with particle methods to get the best of both worlds!

Hybrid Fluid Simulation

Fluid Simulation and other stuffs
Live demo:
https://david.li/

Position-based Dynamics
• It is a different approach w.r.t. solving F=ma equation
• Way more stable!

Position-based Dynamics

Houdini
• A powerful and popular 3D procedural software for modeling, rigging, animation, VFX,
look development, lighting and rendering in film, TV, advertising and video gameThree.js

• Why Three.js if we can do in plain WebGL (almost) whatever we want?!

A simple cube in WebGL

A simple cube in WebGL

A simple cube in WebGL

A simple cube in WebGL

Skills needed for plain WebGL

• GLSL to program shaders
• Lots of math for Matrix computation to set up transformations
• Creating vertex buffers to hold data about vertex positions, normals, colors and

textures

• Take care of every detail about lights, shadows, reflections, animations...

Three.js to the rescue!

• Abstracts away all the painful overhead
• Elegant API to create and manipulate Cameras, Objects, Lights, Materials etc.
• Three.js is Open Source

Cube example in Three.js

Cube example in Three.js

More features

Advanced code on Three.js

• Cloth and wind animation: https://codesandbox.io/p/sandbox/threejs-cloth-animation-example-

sz691?file=%2Fsrc%2Findex.js%3A55%2C1!

• Psychedelic tapeworm: https://boytchev.github.io/etudes/threejs/psychedelic-

tapeworm.html (https://github.com/boytchev/etudes/blob/00dc4563b64e2040e25bef8d4c7ac00289fab36
1/threejs/psychedelic-tapeworm.html)

• Creating a game in three.js: https://blog.logrocket.com/creating-game-three-js/

• A nice video tutorial on

three.js: https://youtube.com/playlist?list=PLOGomoq5sDLutXOHLlESKG2j9CCnCwVqg&si=fPIj4YRBuVka
b3He

Advanced code on plain WebGL

• Keyframe animation: https://veeenu.github.io/blog/implementing-keyframe-animation/

(code: https://github.com/veeenu/veeenu.github.io/tree/master/data/2014-04-22-implementing-
keyframe-animation)

• Skeletal animation: https://veeenu.github.io/blog/implementing-skeletal-

animation/ (code: https://github.com/veeenu/veeenu.github.io/tree/master/data/2014-05-09-
implementing-skeletal-animation)

Bonus: the smallest ray-tracer code in the world *_*

• https://fabiensanglard.net/rayTracing_back_of_business_card/

