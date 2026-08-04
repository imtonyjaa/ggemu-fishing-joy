const WaterEffect = {
    displacementSprite: null,
    displacementFilter: null,
    overlaySprite: null,
    vortexDisplacementSprite: null,
    vortexFilter: null,
    vortexOverlay: null,
    vortexSource: null,
    vortexTimer: 0,
    vortexDuration: 0,
    vortexTarget: null,
    time: 0,
    liveMode: false,
    updateStep: 1,
    updateAccumulator: 0,

    init(app, width, height) {
        const smallSize = 64;
        const bigSize = 256;

        const smallCanvas = document.createElement('canvas');
        smallCanvas.width = smallSize;
        smallCanvas.height = smallSize;
        const smallCtx = smallCanvas.getContext('2d');
        const imageData = smallCtx.createImageData(smallSize, smallSize);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const val = Math.floor(Math.random() * 255);
            imageData.data[i] = val;
            imageData.data[i + 1] = val;
            imageData.data[i + 2] = val;
            imageData.data[i + 3] = 255;
        }
        smallCtx.putImageData(imageData, 0, 0);

        const canvas = document.createElement('canvas');
        canvas.width = bigSize;
        canvas.height = bigSize;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(smallCanvas, 0, 0, bigSize, bigSize);

        const displacementTexture = PIXI.Texture.from(canvas);
        this.displacementSprite = new PIXI.Sprite(displacementTexture);
        this.displacementSprite.width = width;
        this.displacementSprite.height = height;
        this.displacementSprite.texture.source.style.addressMode = 'repeat';
        app.stage.addChild(this.displacementSprite);

        this.displacementFilter = new PIXI.DisplacementFilter({
            sprite: this.displacementSprite,
            scale: { x: 5, y: 5 }
        });

        this.displacementSprite.renderable = false;

        this.setupVortex(app);

        try {
            const overlayTexture = ResourceManager.textures.effect_overlay;
            if (overlayTexture) {
                this.overlaySprite = new PIXI.Sprite(overlayTexture);
                this.overlaySprite.width = width;
                this.overlaySprite.height = height;
                this.overlaySprite.blendMode = 'screen';
                this.overlaySprite.alpha = 0.45;
            }
        } catch (e) {
            console.warn('水光叠加层创建失败:', e);
        }
    },

    setupVortex(app) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(size, size);
        const center = size / 2;

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const nx = (x - center) / center;
                const ny = (y - center) / center;
                const radius = Math.hypot(nx, ny);
                const fade = radius < 1 ? Math.pow(1 - radius, 2) : 0;
                const tangentX = radius > 0 ? -ny / radius : 0;
                const tangentY = radius > 0 ? nx / radius : 0;
                const index = (y * size + x) * 4;

                imageData.data[index] = 128 + (tangentX * 0.85 - nx * 0.2) * 127 * fade;
                imageData.data[index + 1] = 128 + (tangentY * 0.85 - ny * 0.2) * 127 * fade;
                imageData.data[index + 2] = 128;
                imageData.data[index + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const texture = PIXI.Texture.from(canvas);
        this.vortexDisplacementSprite = new PIXI.Sprite(texture);
        this.vortexDisplacementSprite.anchor.set(0.5);
        this.vortexDisplacementSprite.width = 320;
        this.vortexDisplacementSprite.height = 320;
        this.vortexDisplacementSprite.renderable = false;
        app.stage.addChild(this.vortexDisplacementSprite);

        this.vortexFilter = new PIXI.DisplacementFilter({
            sprite: this.vortexDisplacementSprite,
            scale: { x: 0, y: 0 }
        });

        this.vortexOverlay = this.createVortexOverlay();
        this.vortexOverlay.visible = false;
        app.stage.addChild(this.vortexOverlay);
    },

    createVortexOverlay() {
        const overlay = new PIXI.Container();
        const spiral = new PIXI.Graphics();

        for (let arm = 0; arm < 3; arm++) {
            for (let point = 0; point < 52; point++) {
                const progress = point / 51;
                const angle = arm * Math.PI * 2 / 3 + progress * Math.PI * 2.2;
                const radius = 10 + progress * 130;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;

                if (point === 0) spiral.moveTo(x, y);
                else spiral.lineTo(x, y);
            }
        }

        spiral.stroke({ color: 0xB9F4FF, width: 4, alpha: 0.42 });
        overlay.addChild(spiral);

        const center = new PIXI.Graphics();
        center.circle(0, 0, 28);
        center.fill({ color: 0x082B4A, alpha: 0.35 });
        center.stroke({ color: 0xD7FAFF, width: 3, alpha: 0.5 });
        overlay.addChild(center);
        overlay.blendMode = 'screen';
        return overlay;
    },

    startVortex(target, sourceFish, seconds) {
        this.vortexTarget = target;
        this.vortexSource = sourceFish;
        this.vortexTimer = seconds * 60;
        this.vortexDuration = this.vortexTimer;
        this.vortexOverlay.visible = true;

        const filters = Array.isArray(target.filters) ? [...target.filters] : [];
        if (!filters.includes(this.vortexFilter)) {
            filters.push(this.vortexFilter);
            target.filters = filters;
        }
    },

    updateVortex(delta) {
        if (this.vortexTimer <= 0 || !this.vortexSource) return;

        this.vortexTimer = Math.max(0, this.vortexTimer - delta);
        const fadeIn = Math.min(1, (this.vortexDuration - this.vortexTimer) / 15);
        const fadeOut = Math.min(1, this.vortexTimer / 30);
        const strength = Math.min(fadeIn, fadeOut);
        const pulse = 1 + Math.sin(this.time * 0.12) * 0.06;
        const x = this.vortexSource.x;
        const y = this.vortexSource.y;

        this.vortexDisplacementSprite.position.set(x, y);
        this.vortexDisplacementSprite.rotation += 0.018 * delta;
        this.vortexFilter.scale.x = 48 * strength;
        this.vortexFilter.scale.y = 48 * strength;

        this.vortexOverlay.position.set(x, y);
        this.vortexOverlay.rotation -= 0.025 * delta;
        this.vortexOverlay.scale.set(pulse);
        this.vortexOverlay.alpha = strength;

        if (this.vortexTimer === 0) {
            this.stopVortex();
        }
    },

    stopVortex() {
        if (this.vortexTarget) {
            this.vortexTarget.filters = (this.vortexTarget.filters || [])
                .filter((filter) => filter !== this.vortexFilter);
        }

        this.vortexFilter.scale.x = 0;
        this.vortexFilter.scale.y = 0;
        this.vortexOverlay.visible = false;
        this.vortexSource = null;
        this.vortexTarget = null;
        this.vortexDuration = 0;
    },

    update(delta) {
        this.updateAccumulator += delta;

        if (this.updateAccumulator < this.updateStep) {
            return;
        }

        delta = this.updateAccumulator;
        this.updateAccumulator = 0;
        this.time += delta;

        if (this.displacementSprite) {
            const amplitudeX = 19;
            const amplitudeY = 17;

            this.displacementSprite.x = Math.sin(this.time * 0.03) * amplitudeX;
            this.displacementSprite.y = Math.cos(this.time * 0.02) * amplitudeY;
        }

        this.updateVortex(delta);
    }
};
