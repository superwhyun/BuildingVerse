import * as THREE from 'three';

export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000);
        this.camera.position.set(0, 50, 150);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.setupLights();

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.needsUpdate = true;
    }

    setupLights() {
        const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(100, 100, 100);
        this.scene.add(dirLight);
    }

    onWindowResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.requestRender();
    }

    requestRender() {
        this.needsUpdate = true;
    }

    render() {
        if (this.needsUpdate) {
            this.renderer.render(this.scene, this.camera);
            this.needsUpdate = false;
        }
    }
}
