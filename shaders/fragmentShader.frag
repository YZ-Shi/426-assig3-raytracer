// set the precision of the float values (necessary if using float)
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
precision mediump int;

// flag for using soft shadows
#define SOFT_SHADOWS 1

// define number of soft shadow samples to take
#define SOFT_SAMPLING 4

// define constant parameters
// EPS is for the precision issue
#define INFINITY 1.0e+12
#define EPS 1.0e-3

// define maximum recursion depth for rays
#define MAX_RECURSION 8

// define constants for scene setting
#define MAX_LIGHTS 10

// define texture types
#define NONE 0
#define CHECKERBOARD 1
#define MYSPECIAL 2

// define material types
#define BASICMATERIAL 1
#define PHONGMATERIAL 2
#define LAMBERTMATERIAL 3

// define reflect types - how to bounce rays
#define NONEREFLECT 1
#define MIRRORREFLECT 2
#define GLASSREFLECT 3

struct Shape {
  int shapeType;
  vec3 v1;
  vec3 v2;
  float rad;
};

struct Material {
  int materialType;
  vec3 color;
  float shininess;
  vec3 specular;

  int materialReflectType;
  float reflectivity;
  float refractionRatio;
  int special;
};

struct Object {
  Shape shape;
  Material material;
};

struct Light {
  vec3 position;
  vec3 color;
  float intensity;
  float attenuate;
};

struct Ray {
  vec3 origin;
  vec3 direction;
};

struct Intersection {
  vec3 position;
  vec3 normal;
};

// uniform
uniform mat4 uMVMatrix;
uniform int frame;
uniform float height;
uniform float width;
uniform vec3 camera;
uniform int numObjects;
uniform int numLights;
uniform Light lights[MAX_LIGHTS];
uniform vec3 objectNorm;

// varying
varying vec2 v_position;

// find then position some distance along a ray
vec3 rayGetOffset(Ray ray, float dist) {
  return ray.origin + (dist * ray.direction);
}

// if a newly found intersection is closer than the best found so far, record
// the new intersection and return true; otherwise leave the best as it was and
// return false.
bool chooseCloserIntersection(float dist, inout float best_dist,
                              inout Intersection intersect,
                              inout Intersection best_intersect) {
  if (best_dist <= dist)
    return false;
  best_dist = dist;
  best_intersect.position = intersect.position;
  best_intersect.normal = intersect.normal;
  return true;
}

// put any general convenience functions you want up here
// ----------- STUDENT CODE BEGIN ------------
// ----------- Our reference solution uses 118 lines of code.
bool isInsideBox(vec3 pos, vec3 pmin, vec3 pmax) {
  if (pos.x < pmin.x - EPS || pos.x > pmax.x + EPS) return false;
  if (pos.y < pmin.y - EPS || pos.y > pmax.y + EPS) return false;
  if (pos.z < pmin.z - EPS || pos.z > pmax.z + EPS) return false;
  return true;
}

// Randomization. Cited from http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
highp float rand(vec2 co)
{
    highp float a = 12.9898;
    highp float b = 78.233;
    highp float c = 43758.5453;
    highp float dt= dot(co.xy ,vec2(a,b));
    highp float sn= mod(dt,3.14);
    return fract(sin(sn) * c);
}

// gradient
vec3 gradient(int x, int y) {
  vec3 gradients[12];
  gradients[0] = vec3(1.0,1.0,0.0);
  gradients[1] = vec3(-1.0,1.0,0.0);
  gradients[2] = vec3(1.0,-1.0,0.0);
  gradients[3] = vec3(-1.0,-1.0,0.0);
  gradients[4] = vec3(1.0,0.0,1.0);
  gradients[5] = vec3(-1.0,0.0,1.0);
  gradients[6] = vec3(1.0,0.0,-1.0);
  gradients[7] = vec3(-1.0,0.0,-1.0);
  gradients[8] = vec3(0.0,1.0,1.0);
  gradients[9] = vec3(0.0,-1.0,1.0);
  gradients[10] = vec3(0.0,1.0,-1.0);
  gradients[11] = vec3(0.0,-1.0,-1.0);
  vec2 seed = vec2(x, y);
  int temp = int(floor(rand(seed) * 12.0));
  vec3 result;
  for (int key = 0; key < 12; key++) {
    if (key == temp) {
    result = gradients[key];
    break;
    }
  }
}

// Adpated from https://en.wikipedia.org/wiki/Perlin_noise
/* Function to linearly interpolate between a0 and a1
 * Weight w should be in the range [0.0, 1.0]
 *
 * as an alternative, this slightly faster equivalent function (macro) can be used:
 * #define lerp(a0, a1, w) ((a0) + (w)*((a1) - (a0)))
 */
float lerp(float a0, float a1, float w) {
  float temp = 6.0 * pow(w, 5.0) - 15.0 * pow(w, 4.0) + 10.0 * pow(w, 3.0);
  return (1.0 - temp) * a0 + temp * a1;
}

// Computes the dot product of the distance and gradient vectors.
float dotGridGradient(int ix, int iy, float x, float y) {

    // Compute the distance vector
    float dx = x - float(ix);
    float dy = y - float(iy);
    vec2 distance = vec2(dx, dy);

    // Compute the dot-product
    return (dot(distance, gradient(ix, iy).xy) + 1.0) / 2.0;
}

// Compute Perlin noise at coordinates x, y
float perlin(vec3 position) {

    // Determine grid cell coordinates
    int x0 = int(floor(position.x / 2.0) * 2.0);
    int x1 = x0 + 2;
    int y0 = int(floor(position.y / 2.0) * 2.0);
    int y1 = y0 + 2;

    // Determine interpolation weights
    // Could also use higher order polynomial/s-curve here
    float sx = (position.x - float(x0)) / 2.0;
    float sy = (position.y - float(y0)) / 2.0;

    // Interpolate between grid point gradients
    float n0, n1, ix0, ix1, value;

    n0 = dotGridGradient(x0, y0, position.x, position.y);
    n1 = dotGridGradient(x1, y0, position.x, position.y);
    ix0 = lerp(n0, n1, sx);

    n0 = dotGridGradient(x0, y1, position.x, position.y);
    n1 = dotGridGradient(x1, y1, position.x, position.y);
    ix1 = lerp(n0, n1, sx);

    value = lerp(ix0, ix1, sy);
    return value;
}
// ----------- STUDENT CODE END ------------

// forward declaration
float rayIntersectScene(Ray ray, out Material out_mat,
                        out Intersection out_intersect);

// Plane
// this function can be used for plane, triangle, and box
float findIntersectionWithPlane(Ray ray, vec3 norm, float dist,
                                out Intersection intersect) {
  float a = dot(ray.direction, norm);
  float b = dot(ray.origin, norm) - dist;

  if (a < EPS && a > -EPS)
    return INFINITY;

  float len = -b / a;
  if (len < EPS)
    return INFINITY;

  intersect.position = rayGetOffset(ray, len);
  intersect.normal = norm;
  return len;
}

// Triangle
float findIntersectionWithTriangle(Ray ray, vec3 t1, vec3 t2, vec3 t3,
                                   out Intersection intersect) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 28 lines of code.
  // Calculate the norm and distance from the plane of the triangle
  vec3 e1 = t1 - t3;
  vec3 e2 = t2 - t3;
  vec3 norm = normalize(cross(e1, e2));
  float dist = dot(t1, norm);
  // Check if intersection point is inside triangle for each side
  Intersection int_plane;
  float len = findIntersectionWithPlane(ray, norm, dist, int_plane);
  vec3 v1 = t1 - int_plane.position;
  vec3 v2 = t2 - int_plane.position;
  vec3 v3 = t3 - int_plane.position;
  vec3 n1 = normalize(cross(v2, v1));
  if (dot(ray.direction, n1) < EPS) return INFINITY;
  vec3 n2 = normalize(cross(v1, v3));
  if (dot(ray.direction, n2) < EPS) return INFINITY;
  vec3 n3 = normalize(cross(v3, v2));
  if (dot(ray.direction, n3) < EPS) return INFINITY;
  // if the intersection point is inside the triangle, return the intersection position and normal
  intersect.position = int_plane.position;
  intersect.normal = norm;
  return len;
  // ----------- STUDENT CODE END ------------
}

// Sphere
float findIntersectionWithSphere(Ray ray, vec3 center, float radius,
                                 out Intersection intersect) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 25 lines of code.
  // Find the intersection point geometrically
  vec3 l = center - ray.origin;
  float t_ca = dot(l, ray.direction);
  if (t_ca < EPS) return INFINITY;
  float d2 = dot(l, l) - t_ca * t_ca;
  if (d2 > radius * radius + EPS) return INFINITY;
  float t_nc = sqrt(radius * radius - d2);
  float t1 = t_ca - t_nc;
  float t2 = t_ca + t_nc;
  // Decide which is the closest intersection point
  float t;
  if (t1 < t2 - EPS && t1 > EPS) t = t1;
  else if (t2 > EPS) t = t2;
  else return INFINITY;
  intersect.position = rayGetOffset(ray, t);
  vec3 norm = (intersect.position - center) / length(intersect.position - center);
  intersect.normal = norm;
  return t;
  // ----------- STUDENT CODE END ------------
}

// Box
float findIntersectionWithBox(Ray ray, vec3 pmin, vec3 pmax,
                              out Intersection out_intersect) {
  // ----------- STUDENT CODE BEGIN ------------
  // pmin and pmax represent two bounding points of the box
  // pmin stores [xmin, ymin, zmin] and pmax stores [xmax, ymax, zmax]
  // ----------- Our reference solution uses 44 lines of code.
  Intersection itsc;
  float length;
  float min = INFINITY; // no intersection by default

  // Iterate through all six faces of the box, update closest intersection point
  vec3 norm12 = normalize(vec3(pmax.x - pmin.x, 0.0, 0.0));
  float dist1 = dot(pmin, -norm12);
  length = findIntersectionWithPlane(ray, -norm12, dist1, itsc);
  if (isInsideBox(itsc.position, pmin, pmax) ) {
    chooseCloserIntersection(length, min, itsc, out_intersect);
  }

  float dist2 = dot(pmax, norm12);
  length = findIntersectionWithPlane(ray, norm12, dist2, itsc);
  if (isInsideBox(itsc.position, pmin, pmax)) {
    chooseCloserIntersection(length, min, itsc, out_intersect);
  }

  vec3 norm34 = normalize(vec3(0.0, pmax.y - pmin.y, 0.0));
  float dist3 = dot(pmin, -norm34);
  length = findIntersectionWithPlane(ray, -norm34, dist3, itsc);
  if (isInsideBox(itsc.position, pmin, pmax)) {
    chooseCloserIntersection(length, min, itsc, out_intersect);
  }

  float dist4 = dot(pmax, norm34);
  length = findIntersectionWithPlane(ray, norm34, dist4, itsc);
  if (isInsideBox(itsc.position, pmin, pmax)) {
    chooseCloserIntersection(length, min, itsc, out_intersect);
  }

  vec3 norm56 = normalize(vec3(0.0, 0.0, pmax.z - pmin.z));
  float dist5 = dot(pmin, -norm56);
  length = findIntersectionWithPlane(ray, -norm56, dist5, itsc);
  if (isInsideBox(itsc.position, pmin, pmax)) {
    chooseCloserIntersection(length, min, itsc, out_intersect);
  }

  float dist6 = dot(pmax, norm56);
  length = findIntersectionWithPlane(ray, norm56, dist6, itsc);
  if (isInsideBox(itsc.position, pmin, pmax)) {
    chooseCloserIntersection(length, min, itsc, out_intersect);
  }
  return min;
  // ----------- STUDENT CODE END ------------
}

// Cylinder
float getIntersectOpenCylinder(Ray ray, vec3 center, vec3 axis, float len,
                               float rad, out Intersection intersect) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 33 lines of code.
  float a = dot(ray.direction - dot(ray.direction, axis) * axis,
                ray.direction - dot(ray.direction, axis) * axis);
  float b = 2.0 * dot(ray.direction - dot(ray.direction, axis) * axis,
                      ray.origin - center - dot(ray.origin - center, axis) * axis);
  float c = dot(ray.origin - center - dot(ray.origin - center, axis) * axis,
                ray.origin - center - dot(ray.origin - center, axis) * axis) - pow(rad, 2.0);
  float test = pow(b, 2.0) - 4.0 * a * c;
  if (test < EPS) return INFINITY;
  float t1 = (-b + sqrt(test)) / (2.0 * a);
  float t2 = (-b - sqrt(test)) / (2.0 * a);
  // Determine the closest intersection
  float t;
  if (t1 < t2 - EPS && t1 > EPS) t = t1;
  else if (t2 > EPS) t = t2;
  else return INFINITY;
  vec3 pos = rayGetOffset(ray, t);
  // Check if the point is above or below the cylinder
  if (dot(axis, pos - center) <= EPS || dot(axis, pos - (center + axis * len)) >= EPS)
    return INFINITY;
  intersect.position = pos;
  vec3 norm = (intersect.position - center - axis * dot(intersect.position - center, axis)) / rad;
  intersect.normal = norm;
  return t;
  // ----------- STUDENT CODE END ------------
}

float getIntersectDisc(Ray ray, vec3 center, vec3 norm, float rad,
                       out Intersection intersect) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 18 lines of code.
  Intersection its_plane;
  float len = findIntersectionWithPlane(ray, norm, dot(center, norm), its_plane);
  if (len == INFINITY) return INFINITY;
  float dist = length(its_plane.position - center);
  if (dist < EPS) return INFINITY;
  if (dist > rad + EPS) return INFINITY;
  intersect.position = its_plane.position;
  intersect.normal = norm;
  return len;
  // ----------- STUDENT CODE END ------------
}

float findIntersectionWithCylinder(Ray ray, vec3 center, vec3 apex,
                                   float radius,
                                   out Intersection out_intersect) {
  vec3 axis = apex - center;
  float len = length(axis);
  axis = normalize(axis);

  Intersection intersect;
  float best_dist = INFINITY;
  float dist;

  // -- infinite cylinder
  dist = getIntersectOpenCylinder(ray, center, axis, len, radius, intersect);
  chooseCloserIntersection(dist, best_dist, intersect, out_intersect);

  // -- two caps
  dist = getIntersectDisc(ray, center, -axis, radius, intersect);
  chooseCloserIntersection(dist, best_dist, intersect, out_intersect);
  dist = getIntersectDisc(ray, apex, axis, radius, intersect);
  chooseCloserIntersection(dist, best_dist, intersect, out_intersect);
  return best_dist;
}

// Cone
float getIntersectOpenCone(Ray ray, vec3 apex, vec3 axis, float len,
                           float radius, out Intersection intersect) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 45 lines of code.
  // Find the intersection points
  float cos_alpha = cos(atan(radius / len));
  float sin_alpha = sin(atan(radius / len));
  vec3 delta_p = ray.origin - apex;
  float dot1 = dot(ray.direction, -axis);
  float dot2 = dot(delta_p, -axis);
  float a = pow(cos_alpha, 2.0) * dot(ray.direction - dot1 * -axis, ray.direction - dot1 * -axis)
            - pow(sin_alpha, 2.0) * pow(dot1, 2.0);
  float b = 2.0 * pow(cos_alpha, 2.0) * dot(ray.direction - dot1 * -axis, delta_p - dot2 * -axis)
            - 2.0 * pow(sin_alpha, 2.0) * dot1 * dot2;
  float c = pow(cos_alpha, 2.0) * dot(delta_p - dot2 * -axis, delta_p - dot2 * -axis)
            - pow(sin_alpha, 2.0) * pow(dot2, 2.0);
  float test = pow(b, 2.0) - 4.0 * a * c;
  if (test < EPS) return INFINITY;
  float t1 = (-b + sqrt(test)) / (2.0 * a);
  float t2 = (-b - sqrt(test)) / (2.0 * a);
  // Determine the closest intersection point
  float t;
  if (t1 < t2 - EPS && t1 > EPS) t = t1;
  else if (t2 > EPS) t = t2;
  else return INFINITY;
  vec3 pos = rayGetOffset(ray, t);
  // Is the intersection point within the height of the cone?
  if (dot(-axis, pos - (apex + axis * len)) <= EPS || dot(-axis, pos - apex) >= EPS)
    return INFINITY;
  intersect.position = pos;
  vec3 e = intersect.position - apex;
  vec3 norm = normalize(e - length(e) / cos_alpha * axis);
  intersect.normal = norm;
  return t;
  // ----------- STUDENT CODE END ------------
}

float findIntersectionWithCone(Ray ray, vec3 center, vec3 apex, float radius,
                               out Intersection out_intersect) {
  vec3 axis = center - apex;
  float len = length(axis);
  axis = normalize(axis);

  // -- infinite cone
  Intersection intersect;
  float best_dist = INFINITY;
  float dist;

  // -- infinite cone
  dist = getIntersectOpenCone(ray, apex, axis, len, radius, intersect);
  chooseCloserIntersection(dist, best_dist, intersect, out_intersect);

  // -- caps
  dist = getIntersectDisc(ray, center, axis, radius, intersect);
  chooseCloserIntersection(dist, best_dist, intersect, out_intersect);

  return best_dist;
}

vec3 calculateSpecialDiffuseColor(Material mat, vec3 posIntersection,
                                  vec3 normalVector) {
  // ----------- STUDENT CODE BEGIN ------------
  if (mat.special == CHECKERBOARD) {
    // ----------- Our reference solution uses 7 lines of code.
    float check = floor(posIntersection.x / 8.0 + EPS) + floor(posIntersection.y / 8.0 + EPS)
                  + floor(posIntersection.z / 8.0 + EPS);
    if (abs(mod(check, 2.0) - 1.0) < EPS)
      return (mat.color + vec3(0.0, 0.0, 0.0)) / 2.0;
    else return (mat.color + vec3(1.0, 1.0, 1.0)) / 2.0;
  } else if (mat.special == MYSPECIAL) {
    // ----------- Our reference solution uses 5 lines of code.
    float factor = perlin(posIntersection);
    return factor * mat.color;
  }

  // If not a special material, just return material color.
  return mat.color;
  // ----------- STUDENT CODE END ------------
}

vec3 calculateDiffuseColor(Material mat, vec3 posIntersection,
                           vec3 normalVector) {
  // Special colors
  if (mat.special != NONE) {
    return calculateSpecialDiffuseColor(mat, posIntersection, normalVector);
  }
  return vec3(mat.color);
}

// check if position pos in in shadow with respect to a particular light.
// lightVec is the vector from that position to that light -- it is not
// normalized, so its length is the distance from the position to the light
bool pointInShadow(vec3 pos, vec3 lightVec) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 15 lines of code.
  Ray ray;
  Material out_mat;
  Intersection out_intersect;
  ray.origin = pos;
  ray.direction = normalize(lightVec);
  float dist = rayIntersectScene(ray, out_mat, out_intersect);
  if (dist < length(lightVec) - EPS) return true;
  return false;
  // ----------- STUDENT CODE END ------------
}

vec2 seed(int i, int j, vec3 intersectPos, vec3 lightVec) {
  float temp = dot(intersectPos, lightVec);
  vec2 result  = vec2(temp * float(i), temp * float(j));
  //vec2 result = vec2(float(i), float(j));
  return result;
}

// use random sampling to compute a ratio that represents the
// fractional contribution of the light to the position pos.
// lightVec is the vector from that position to that light -- it is not
// normalized, so its length is the distance from the position to the light
float softShadowRatio(vec3 pos, vec3 lightVec) {
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 19 lines of code.
  //vec3 lightPos = pos - lightVec;
  const int n = SOFT_SAMPLING;
  //float width = 2.0 / float(n);
  //vec2 seed = vec2(0.1, 0.1);
  float count = 0.0;
  // first calculate the centroids, and randomize
  for (int i = 0; i < n; i++) {
    for (int j = 0; j < n; j++) {
      //float u, x2;
      float offset_x = float(i / n);
      float offset_y = float(j / n);
        //float rand_x = rand(seed(i, j, pos, lightVec));
        //float rand_y = rand(seed(-i, j, pos, lightVec));
        //float rand_x = rand(seed(i, j));
        //float rand_y = rand(seed(-i, j));
        float rand_u = rand(seed(i, j, pos, lightVec));
        float rand_theta = rand(seed(-i, j, pos, lightVec));
        float jitter_x = offset_x + (rand_u / float(n));
        float jitter_y = offset_y + (rand_theta / float(n));
        float u = jitter_x * 2.0 - 1.0 + EPS;
        float theta = jitter_y * 2.0 * 3.14 + EPS;
        //float jitter_x = offset_x + (rand_x / float(n));
        //float jitter_y = offset_y + (rand_y / float(n));
        //x1 = jitter_x * 2.0 - 1.0;
        //x2 = jitter_y * 2.0 - 1.0;
        //if (pow(x1, 2.0) + pow(x2, 2.0) - 1.0 < EPS) break;
      //float x1 = -1.0 + width * (float(i) - 0.5) + (rand(seed) * width - width / 2.0);
      //float x2 = -1.0 + width * (float(j) - 0.5) + (rand(seed) * width - width / 2.0);
      //float x = 2.0 * x1 * sqrt(1.0 - pow(x1, 2.0) - pow(x2, 2.0));
      //float y = 2.0 * x2 * sqrt(1.0 - pow(x1, 2.0) - pow(x2, 2.0));
      //float z = 1.0 - 2.0 * (pow(x1, 2.0) + pow(x2, 2.0));
      float x = sqrt(1.0 - pow(u, 2.0)) * cos(theta);
      float y = sqrt(1.0 - pow(u, 2.0)) * sin(theta);
      float z = u;
      //vec3 newLightPos = vec3(x, y, z) + lightPos;
      //vec3 newLightVec = pos - newLightPos;
      vec3 newLightVec = vec3(x, y, z)*3.0 + lightVec;
      if (!pointInShadow(pos, newLightVec)) {
        count += 1.0;
      }
    }
  }
  return count / float(n * n);
  //return 0.0;
  // ----------- STUDENT CODE END ------------
}

vec3 getLightContribution(Light light, Material mat, vec3 posIntersection,
                          vec3 normalVector, vec3 eyeVector, bool phongOnly,
                          vec3 diffuseColor) {
  vec3 lightVector = light.position - posIntersection;


  float ratio = 1.0; // default to 1.0 for hard shadows
  if (SOFT_SHADOWS == 1) {
    // if using soft shadows, call softShadowRatio to determine
    // fractional light contribution
    ratio = softShadowRatio(posIntersection, lightVector);
  }
  else {
    // check if point is in shadow with light vector
    if (pointInShadow(posIntersection, lightVector)) {
      return vec3(0.0, 0.0, 0.0);
    }
  }

  // Slight optimization for soft shadows
  if (ratio < EPS) {
    return vec3(0.0, 0.0, 0.0);
  }


  // normalize the light vector for the computations below
  float distToLight = length(lightVector);
  lightVector /= distToLight;

  if (mat.materialType == PHONGMATERIAL ||
      mat.materialType == LAMBERTMATERIAL) {
    vec3 contribution = vec3(0.0, 0.0, 0.0);

    // get light attenuation
    float attenuation = light.attenuate * distToLight;
    float diffuseIntensity =
        max(0.0, dot(normalVector, lightVector)) * light.intensity;

    // glass and mirror objects have specular highlights but no diffuse lighting
    if (!phongOnly) {
      contribution +=
          diffuseColor * diffuseIntensity * light.color / attenuation;
    }

    if (mat.materialType == PHONGMATERIAL) {
      // Start with just black by default (i.e. no Phong term contribution)
      vec3 phongTerm = vec3(0.0, 0.0, 0.0);
      // ----------- STUDENT CODE BEGIN ------------
      // ----------- Our reference solution uses 4 lines of code.
      vec3 refl = reflect(-lightVector, normalVector);
      phongTerm += mat.specular * pow(max(0.0, dot(eyeVector, refl)), mat.shininess) * light.intensity / attenuation;
      // ----------- STUDENT CODE END ------------
      contribution += phongTerm;
    }

    return ratio * contribution;
  } else {
    return ratio * diffuseColor;
  }
}

vec3 calculateColor(Material mat, vec3 posIntersection, vec3 normalVector,
                    vec3 eyeVector, bool phongOnly) {
  // The diffuse color of the material at the point of intersection
  // Needed to compute the color when accounting for the lights in the scene
  vec3 diffuseColor = calculateDiffuseColor(mat, posIntersection, normalVector);

  // color defaults to black when there are no lights
  vec3 outputColor = vec3(0.0, 0.0, 0.0);

  // Loop over the MAX_LIGHTS different lights, taking care not to exceed
  // numLights (GLSL restriction), and accumulate each light's contribution
  // to the point of intersection in the scene.
  // ----------- STUDENT CODE BEGIN ------------
  // ----------- Our reference solution uses 9 lines of code.
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= numLights) break;
    vec3 result = getLightContribution(lights[i], mat, posIntersection, normalVector, eyeVector, phongOnly, diffuseColor);
    outputColor += result;
  }
  return outputColor;
  // Return diffuseColor by default, so you can see something for now.
  return diffuseColor;
  // ----------- STUDENT CODE END ------------
}

// find reflection or refraction direction (depending on material type)
vec3 calcReflectionVector(Material material, vec3 direction, vec3 normalVector,
                          bool isInsideObj) {
  if (material.materialReflectType == MIRRORREFLECT) {
    return reflect(direction, normalVector);
  }
  // If it's not mirror, then it is a refractive material like glass.
  // Compute the refraction direction.
  // See lecture 13 slide (lighting) on Snell's law.
  // The eta below is eta_i/eta_r.
  // ----------- STUDENT CODE BEGIN ------------
  float eta =
      (isInsideObj) ? 1.0 / material.refractionRatio : material.refractionRatio;
  // ----------- Our reference solution uses 5 lines of code.
  float theta_i = acos(dot(normalVector, -direction));
  float theta_r = asin(sin(theta_i) * eta);
  if (theta_r < EPS) return reflect(direction, normalVector);
  vec3 refract = (eta * cos(theta_i) - cos(theta_r)) * normalVector + eta * direction;
  return refract;
  // ----------- STUDENT CODE END ------------
}

vec3 traceRay(Ray ray) {
  // Accumulate the final color from tracing this ray into resColor.
  vec3 resColor = vec3(0.0, 0.0, 0.0);

  // Accumulate a weight from tracing this ray through different materials
  // based on their BRDFs. Initially all 1.0s (i.e. scales the initial ray's
  // RGB color by 1.0 across all color channels). This captures the BRDFs
  // of the materials intersected by the ray's journey through the scene.
  vec3 resWeight = vec3(1.0, 1.0, 1.0);

  // Flag for whether the ray is currently inside of an object.
  bool isInsideObj = false;

  // Iteratively trace the ray through the scene up to MAX_RECURSION bounces.
  for (int depth = 0; depth < MAX_RECURSION; depth++) {
    // Fire the ray into the scene and find an intersection, if one exists.
    //
    // To do so, trace the ray using the rayIntersectScene function, which
    // also accepts a Material struct and an Intersection struct to store
    // information about the point of intersection. The function returns
    // a distance of how far the ray travelled before it intersected an object.
    //
    // Then, check whether or not the ray actually intersected with the scene.
    // A ray does not intersect the scene if it intersects at a distance
    // "equal to zero" or far beyond the bounds of the scene. If so, break
    // the loop and do not trace the ray any further.
    // (Hint: You should probably use EPS and INFINITY.)
    // ----------- STUDENT CODE BEGIN ------------
    Material hitMaterial;
    Intersection intersect;
    // ----------- Our reference solution uses 4 lines of code.
    float dist = rayIntersectScene(ray, hitMaterial, intersect);
    if (abs(dist) <= EPS || dist >= INFINITY) break;
    // ----------- STUDENT CODE END ------------

    // Compute the vector from the ray towards the intersection.
    vec3 posIntersection = intersect.position;
    vec3 normalVector    = intersect.normal;

    vec3 eyeVector = normalize(ray.origin - posIntersection);

    // Determine whether we are inside an object using the dot product
    // with the intersection's normal vector
    if (dot(eyeVector, normalVector) < 0.0) {
        normalVector = -normalVector;
        isInsideObj = true;
    } else {
        isInsideObj = false;
    }

    // Material is reflective if it is either mirror or glass in this assignment
    bool reflective = (hitMaterial.materialReflectType == MIRRORREFLECT ||
                       hitMaterial.materialReflectType == GLASSREFLECT);

    // Compute the color at the intersection point based on its material
    // and the lighting in the scene
    vec3 outputColor = calculateColor(hitMaterial, posIntersection,
      normalVector, eyeVector, reflective);

    // A material has a reflection type (as seen above) and a reflectivity
    // attribute. A reflectivity "equal to zero" indicates that the material
    // is neither reflective nor refractive.

    // If a material is neither reflective nor refractive...
    // (1) Scale the output color by the current weight and add it into
    //     the accumulated color.
    // (2) Then break the for loop (i.e. do not trace the ray any further).
    // ----------- STUDENT CODE BEGIN ------------
    // ----------- Our reference solution uses 4 lines of code.
    if (!reflective || abs(hitMaterial.reflectivity) < EPS) {
      outputColor *= resWeight;
      resColor += outputColor;
      break;
    }
    // ----------- STUDENT CODE END ------------

    // If the material is reflective or refractive...
    // (1) Use calcReflectionVector to compute the direction of the next
    //     bounce of this ray.
    // (2) Update the ray object with the next starting position and
    //     direction to prepare for the next bounce. You should modify the
    //     ray's origin and direction attributes. Be sure to normalize the
    //     direction vector.
    // (3) Scale the output color by the current weight and add it into
    //     the accumulated color.
    // (4) Update the current weight using the material's reflectivity
    //     so that it is the appropriate weight for the next ray's color.
    // ----------- STUDENT CODE BEGIN ------------
    // ----------- Our reference solution uses 8 lines of code.
    else {
      vec3 next = calcReflectionVector(hitMaterial, ray.direction, normalVector, isInsideObj);
      ray.origin = intersect.position;
      ray.direction = normalize(next);
      outputColor *= resWeight;
      resColor += outputColor;
      resWeight *= hitMaterial.reflectivity;
    }
    // ----------- STUDENT CODE END ------------
  }

  return resColor;
}

void main() {
  float cameraFOV = 0.8;
  vec3 direction = vec3(v_position.x * cameraFOV * width / height,
                        v_position.y * cameraFOV, 1.0);

  Ray ray;
  ray.origin = vec3(uMVMatrix * vec4(camera, 1.0));
  ray.direction = normalize(vec3(uMVMatrix * vec4(direction, 0.0)));

  // trace the ray for this pixel
  vec3 res = traceRay(ray);

  // paint the resulting color into this pixel
  gl_FragColor = vec4(res.x, res.y, res.z, 1.0);
}
