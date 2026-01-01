import { SceneManager } from './scene.js';
import { WorldManager } from './world_manager.js';
import { Controls } from './controls.js';
import { Interaction } from './interaction.js';

class App {
    constructor() {
        this.sceneManager = new SceneManager('canvas-container');
        this.worldManager = new WorldManager(this.sceneManager);
        this.controls = new Controls(this.sceneManager.camera, this.worldManager);
        this.interaction = new Interaction(this.sceneManager, this.worldManager);

        this.lastTime = 0;
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        this.init();
    }

    async init() {
        console.log("App Initialized");
        await this.worldManager.loadBuildings();
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        const delta = (time - this.lastTime) / 1000;
        this.lastTime = time;

        if (this.controls.update(delta)) {
            this.sceneManager.requestRender();
        }
        this.worldManager.update(delta);
        if (this.interaction.update) this.interaction.update(delta);

        this.sceneManager.render();
    }
}

new App();
