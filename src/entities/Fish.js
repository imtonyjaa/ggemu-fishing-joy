class Fish extends PIXI.Container {
    static types = {
        1: { id: "fish1", coin: 2, rarity: 1, speed: 1.5, frames: 4, captureFrames: 4, width: 55, height: 37, regX: 35, regY: 12, collRect: [10, 5, 45, 17] },
        2: { id: "fish2", coin: 3, rarity: 2, speed: 1.5, frames: 4, captureFrames: 4, width: 78, height: 64, regX: 58, regY: 20, collRect: [15, 10, 63, 22] },
        3: { id: "fish3", coin: 5, rarity: 3, speed: 1.5, frames: 4, captureFrames: 4, width: 72, height: 56, regX: 52, regY: 18, collRect: [5, 5, 67, 23] },
        4: { id: "fish4", coin: 8, rarity: 4, speed: 1.5, frames: 4, captureFrames: 4, width: 77, height: 59, regX: 57, regY: 18, collRect: [10, 5, 67, 23] },
        5: { id: "fish5", coin: 10, rarity: 5, speed: 1.2, frames: 4, captureFrames: 4, width: 107, height: 122, regX: 67, regY: 50, collRect: [20, 30, 80, 40] },
        6: { id: "fish6", coin: 20, rarity: 6, speed: 1.2, frames: 8, captureFrames: 4, width: 105, height: 79, regX: 65, regY: 25, collRect: [45, 0, 60, 55] },
        7: { id: "fish7", coin: 30, rarity: 7, speed: 1.0, frames: 6, captureFrames: 4, width: 92, height: 151, regX: 40, regY: 50, collRect: [15, 5, 70, 75] },
        8: { id: "fish8", coin: 40, rarity: 8, speed: 1.0, frames: 8, captureFrames: 4, width: 174, height: 126, regX: 90, regY: 50, collRect: [20, 20, 100, 55] },
        9: { id: "fish9", coin: 50, rarity: 9, speed: 0.8, frames: 8, captureFrames: 4, width: 166, height: 183, regX: 120, regY: 70, collRect: [60, 10, 100, 130] },
        10: { id: "fish10", coin: 60, rarity: 10, speed: 0.8, frames: 6, captureFrames: 4, width: 178, height: 187, regX: 100, regY: 80, collRect: [20, 30, 150, 90] },
        11: { id: "shark1", coin: 100, rarity: 11, speed: 0.6, frames: 8, captureFrames: 4, width: 509, height: 270, regX: 350, regY: 130, collRect: [20, 50, 480, 170] },
        12: { id: "shark2", coin: 200, rarity: 11, speed: 0.5, frames: 8, captureFrames: 4, width: 516, height: 273, regX: 350, regY: 130, collRect: [20, 50, 480, 170] }
    };

    constructor(typeIndex, spawnOptions = {}) {
        super();
        this.typeIndex = typeIndex;
        this.type = Fish.types[typeIndex];
        this.isDead = false;
        this.captured = false;
        this.hasEnteredScreen = false;
        this.speedMultiplier = typeof spawnOptions.speedMultiplier === 'number'
            ? spawnOptions.speedMultiplier
            : 1;
        this.animationSpeedMultiplier = typeof spawnOptions.animationSpeedMultiplier === 'number'
            ? spawnOptions.animationSpeedMultiplier
            : 1;

        // 捕获累积因子 (相对于基础概率的比例)，初始为 0.00
        this.captureAccumulationFactor = 0.0;

        const swimFrames = [];
        for (let i = 0; i < this.type.frames; i++) {
            swimFrames.push(ResourceManager.getTexture(this.type.id, [0, i * this.type.height, this.type.width, this.type.height]));
        }

        this.sprite = new PIXI.AnimatedSprite(swimFrames);
        this.sprite.animationSpeed = 0.1 * this.animationSpeedMultiplier;
        this.sprite.play();
        this.sprite.anchor.set(this.type.regX / this.type.width, this.type.regY / this.type.height);

        this.addChild(this.sprite);

        this.initPosition(spawnOptions);
    }

    initPosition(spawnOptions = {}) {
        const side = spawnOptions.side || (Math.random() > 0.5 ? 'left' : 'right');
        const spawnOffset = typeof spawnOptions.spawnOffset === 'number'
            ? spawnOptions.spawnOffset
            : 100 + Math.random() * 60;

        if (side === 'left') {
            this.x = -spawnOffset;
            this.rotation = typeof spawnOptions.rotation === 'number'
                ? spawnOptions.rotation
                : Math.random() * 0.4 - 0.2;
        } else {
            this.x = Game.width + spawnOffset;
            this.rotation = typeof spawnOptions.rotation === 'number'
                ? spawnOptions.rotation
                : Math.PI + (Math.random() * 0.4 - 0.2);
        }

        this.y = typeof spawnOptions.y === 'number'
            ? spawnOptions.y
            : Math.random() * (Game.height - 200) + 100;

        this.turnSpeed = typeof spawnOptions.turnSpeed === 'number'
            ? spawnOptions.turnSpeed
            : (Math.random() - 0.5) * 0.001;
    }

    update(delta) {
        if (this.captured) return;

        const movementSpeed = this.type.speed * this.speedMultiplier;

        this.rotation += this.turnSpeed * delta;

        this.x += Math.cos(this.rotation) * movementSpeed * delta;
        this.y += Math.sin(this.rotation) * movementSpeed * delta;

        // 保持鱼永远背部朝上 (右侧游动 cos > 0, 左侧游动 cos < 0)
        // 向左游时垂直翻转精灵，使其看起来是正的
        const isHeadingLeft = Math.cos(this.rotation) < 0;
        this.sprite.scale.y = isHeadingLeft ? -1 : 1;

        // 处理特殊的初始旋转偏移
        if (this.type.rotationOffset) {
            this.sprite.rotation = isHeadingLeft ? -this.type.rotationOffset : this.type.rotationOffset;
        }

        const leftBound = -200;
        const rightBound = Game.width + 200;
        const topBound = -200;
        const bottomBound = Game.height + 200;

        if (!this.hasEnteredScreen) {
            if (this.x >= leftBound && this.x <= rightBound && this.y >= topBound && this.y <= bottomBound) {
                this.hasEnteredScreen = true;
            } else if (this.x < -2500 || this.x > Game.width + 2500 || this.y < -2500 || this.y > Game.height + 2500) {
                this.isDead = true;
            }
        } else {
            if (this.x < leftBound || this.x > rightBound || this.y < topBound || this.y > bottomBound) {
                this.isDead = true;
            }
        }
    }

    increaseAccumulation() {
        // 每次命中增加 0.5% 的基础概率加成，上限为 30%
        this.captureAccumulationFactor = Math.min(0.3, this.captureAccumulationFactor + 0.005);
    }

    capture() {
        if (this.captured) return;
        this.captured = true;

        const captureFrames = [];
        const captureCount = this.type.captureFrames || 4;
        const startFrame = this.type.frames;
        for (let i = startFrame; i < startFrame + captureCount; i++) {
            captureFrames.push(ResourceManager.getTexture(this.type.id, [0, i * this.type.height, this.type.width, this.type.height]));
        }

        if (captureFrames.length > 0) {
            this.sprite.textures = captureFrames;
            this.sprite.loop = false;
            this.sprite.onComplete = () => {
                this.isDead = true;
            };
            this.sprite.play();
        } else {
            this.isDead = true;
        }
    }
}
