
export const fragmentShaderSource = `
precision mediump float;

varying vec4 vColor;
varying vec3 vConic;
varying vec2 vCenter;
varying float vDistance;
varying float vPlaneSide;

uniform vec2 viewport;
uniform vec2 focal;
uniform float minAlpha;
uniform float sphereRadius;

uniform vec3 planeNormal;

void main () {
    // Sphere radius = -1.0 means no sphere masking
    // vPlaneSide = 1.0 means the fragment is on the plane side
    //vPlaneSide就该例下来说，一直都为0
    if(vPlaneSide > 0.0) {
        discard;
    }
    //椭球的半径不为-1.0，且距离大于半径，则丢弃
    if (sphereRadius != -1.0 && (vDistance > sphereRadius)) {
        discard;
    }
    //中心坐标减去片元坐标，乘以视口大小，得到一个向量，距离中心的距离向量？
	vec2 d = (vCenter - 2.0 * (gl_FragCoord.xy/viewport - vec2(0.5, 0.5))) * viewport * 0.5;
    //当前片元距离高斯中心的距离

    // 计算高斯分布概率的指数部分
    // vConic.x, vConic.y, vConic.z分别代表椭球的长轴、短轴、焦距
    //高斯分布的的指数部分，dx²*vConic.x + dy²*vConic.z+ dx*dy*vConic.y
	float power = -0.5 * (vConic.x * d.x * d.x + vConic.z * d.y * d.y) + vConic.y * d.x * d.y;

	if (power > 0.0) discard;
	float alpha = min(0.99, vColor.a * exp(power));
	if(alpha < minAlpha) discard;
    //最终其实是为了计算该点的透明度；
    gl_FragColor = vec4(vColor.rgb, vColor.a);
}
`;
