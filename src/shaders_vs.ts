// https://github.com/vincent-lecrubier-skydio/react-three-fiber-gaussian-splat
export const vertexShaderSource = `
precision mediump float;

attribute vec3 position;

attribute vec4 color;
attribute vec4 quat;
attribute vec3 scale;
attribute vec3 center;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 focal;
uniform vec2 viewport;
uniform vec3 sphereCenter;
uniform vec3 planeNormal;
uniform float planeDistance;

varying vec4 vColor;
varying vec3 vConic;
varying vec2 vCenter;
varying vec2 vPosition;
varying float vDistance;
varying float vPlaneSide;




mat3 transpose(mat3 m) { return mat3(m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]); }
//计算3D协方差矩阵
mat3 compute_cov3d(vec3 scale, vec4 rot) {
    //根据scale和qaut，rot
    //scale放在轴上
    //缩放矩阵
    mat3 S = mat3(
        scale.x, 0.0, 0.0,
        0.0, scale.y, 0.0,
        0.0, 0.0, scale.z
    );
    //旋转矩阵
    //将四元数转换为旋转矩阵
    mat3 R = mat3(
        1.0 - 2.0 * (rot.z * rot.z + rot.w * rot.w), 2.0 * (rot.y * rot.z - rot.x * rot.w), 2.0 * (rot.y * rot.w + rot.x * rot.z),
        2.0 * (rot.y * rot.z + rot.x * rot.w), 1.0 - 2.0 * (rot.y * rot.y + rot.w * rot.w), 2.0 * (rot.z * rot.w - rot.x * rot.y),
        2.0 * (rot.y * rot.w - rot.x * rot.z), 2.0 * (rot.z * rot.w + rot.x * rot.y), 1.0 - 2.0 * (rot.y * rot.y + rot.z * rot.z)
    );
    //协方差矩阵M是通过缩放矩阵*旋转矩阵得到的
    mat3 M = S * R;
    return transpose(M) * M;
}
//在计算机图形学和计算机视觉中，协方差矩阵常用于描述物体在3D空间中的不确定性或变化。
//计算物体在屏幕上的投影位置及其不确定性。这对于增强现实（AR）、虚拟现实（VR）、物体跟踪、增强测量等应用非常有用
vec3 compute_cov2d(vec3 center, vec3 scale, vec4 rot){
    //计算3D协方差矩阵
    mat3 Vrk = compute_cov3d(scale, rot);
    //得到投影后的坐标
    vec4 t = modelViewMatrix * vec4(center, 1.0);
    //计算视口的限制范围lims，用于裁剪投影后的坐标。
    vec2 lims = 1.3 * 0.5 * viewport / focal;
    t.xy = min(lims, max(-lims, t.xy / t.z)) * t.z;
    //根据投影后的坐标t和焦距focal，计算雅可比矩阵J。雅可比矩阵用于描述函数的局部线性近似。
    mat3 J = mat3(
        focal.x / t.z, 0., -(focal.x * t.x) / (t.z * t.z),
        0., focal.y / t.z, -(focal.y * t.y) / (t.z * t.z),
        0., 0., 0.
    );
    //算模型视图矩阵的转置矩阵W。
    mat3 W = transpose(mat3(modelViewMatrix));
    mat3 T = W * J;
    //过矩阵乘法计算最终的协方差矩阵cov。
    mat3 cov = transpose(T) * transpose(Vrk) * T;
    return vec3(cov[0][0] + 0.3, cov[0][1], cov[1][1] + 0.3);
}

void main () {
    //固定为0,0 ; center计算当前距离半球中心的距离,center是spalt模型中存储的中心
    //相当于每个点位都有一个中心
    vDistance = length(center - sphereCenter);
    //平面，中心点乘平面的法线+点到平面的距离，planeNormal也一直为0,0,0
    //所以该平面相当于平行于基准平面，然后统一进行了平移
    vPlaneSide = dot(center, planeNormal) + planeDistance;
    vPlaneSide = .0; //一直都是0
    //modelViewMatrix，转换到相机空间下
    vec4 camspace = modelViewMatrix * vec4(center, 1);
    //转换到平面坐标系下
    vec4 pos2d = projectionMatrix  * camspace;
    //根据中心，scale，和quat计算一个向量
    //二维卷积，输入参数为， center 向量，scale3 vec3,quat vec4
    //卷积即为3*3 or算子与矩阵相乘，做图像处理，如锐化，平滑等；
    //quat四元数，变相来说，就是位置，大小，旋转
    vec3 cov2d = compute_cov2d(center, scale, quat);
    //计算协方差矩阵的行列式
    float det = cov2d.x * cov2d.z - cov2d.y * cov2d.y;
    //计算协方差矩阵的逆矩阵
    vec3 conic = vec3(cov2d.z, cov2d.y, cov2d.x) / det;
    //计算协方差矩阵的特征值
    float mid = 0.5 * (cov2d.x + cov2d.z);
    //计算协方差矩阵的特征值
    float lambda1 = mid + sqrt(max(0.1, mid * mid - det));
    //计算协方差矩阵的特征值
    float lambda2 = mid - sqrt(max(0.1, mid * mid - det));
    //计算协方差矩阵的特征向量
    vec2 v1 = 7.0 * sqrt(lambda1) * normalize(vec2(cov2d.y, lambda1 - cov2d.x));
    //计算协方差矩阵的特征向量
    vec2 v2 = 7.0 * sqrt(lambda2) * normalize(vec2(-(lambda1 - cov2d.x),cov2d.y));
    //赋值片元颜色
    vColor = color;
    //赋值卷积核
    vConic = conic;
    //赋值中心点
    vCenter = vec2(pos2d) / pos2d.w;

    //赋值位置
    vPosition = vec2(vCenter + position.x * (position.y < 0.0 ? v1 : v2) / viewport);
    gl_Position = vec4(vPosition, pos2d.z / pos2d.w, 1);
}
`;

