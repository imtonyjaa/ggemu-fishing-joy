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

        // 血条系统 (保底系统)
        // 根据 RTP 系数反算 HP，保证数值平衡 (HP = 价值 / RTP)
        const rtp = CaptureRules.getRtpMultiplier(this.type.coin);
        
        // 动态护甲：小鱼脆皮（保证秒杀爽感），大鱼皮厚（防纯平砍刷钱）
        let armorMultiplier = 1.0;
        if (this.type.coin <= 5) {
            armorMultiplier = 0.9; // 2金币鱼: HP 1.81 * 0.9 = 1.63 < 2.0 (Great 必秒)
        } else if (this.type.coin > 50) {
            armorMultiplier = 1.3; // 鲨鱼增加装甲
        } else {
            // 中型鱼平滑过渡
            const t = (this.type.coin - 5) / 45;
            armorMultiplier = 0.9 + t * (1.3 - 0.9);
        }

        this.maxHp = (this.type.coin / rtp) * armorMultiplier;
        this.hp = this.maxHp;
        this.hpBarVisibleTimer = 0;

        this.setupHpBar();

        const swimFrames = [];
        for (let i = 0; i < this.type.frames; i++) {
            swimFrames.push(ResourceManager.getTexture(this.type.id, [0, i * this.type.height, this.type.width, this.type.height]));
        }

        this.sprite = new PIXI.AnimatedSprite(swimFrames);
        this.sprite.animationSpeed = 0.1 * this.animationSpeedMultiplier;
        this.sprite.play();
        this.sprite.anchor.set(this.type.regX / this.type.width, this.type.regY / this.type.height);

        this.setupHpBar();

        this.addChild(this.sprite);

        this.initPosition(spawnOptions);
    }

    setupHpBar() {
        this.hpBarContainer = new PIXI.Container();
        this.hpBarContainer.visible = false;
        if (Game.effectContainer) {
            Game.effectContainer.addChild(this.hpBarContainer);
        }

        const barWidth = 60; // 固定宽度
        const barHeight = 4;

        const bg = new PIXI.Graphics();
        bg.rect(-barWidth / 2, 0, barWidth, barHeight);
        bg.fill({ color: 0x000000, alpha: 0.5 });
        this.hpBarContainer.addChild(bg);

        this.hpFill = new PIXI.Graphics();
        this.hpBarContainer.addChild(this.hpFill);

        this.updateHpBarVisual();

        // 将血条置于鱼的上方
        this.hpBarContainer.y = -35;
    }

    updateHpBarVisual() {
        const barWidth = 60;
        const barHeight = 4;
        const fillWidth = (this.hp / this.maxHp) * barWidth;

        this.hpFill.clear();
        this.hpFill.rect(-barWidth / 2, 0, fillWidth, barHeight);
        this.hpFill.fill({ color: 0xFF0000 }); // 红色血条
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

        if (this.hpBarVisibleTimer > 0) {
            this.hpBarVisibleTimer -= delta;
            this.hpBarContainer.alpha = Math.min(1, this.hpBarVisibleTimer / 20);

            // 保持血条在鱼的上方，且不受鱼自身旋转和缩放影响
            this.hpBarContainer.x = this.x;
            this.hpBarContainer.y = this.y - 35;
            this.hpBarContainer.rotation = 0;
            this.hpBarContainer.scale.set(1);

            if (this.hpBarVisibleTimer <= 0) {
                this.hpBarContainer.visible = false;
            }
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

    takeDamage(amount, accuracyLabel, isCritical = false, isOneShot = false) {
        this.hp = Math.max(0, this.hp - amount);
        this.updateHpBarVisual();

        // 显示飘血文字
        if (amount > 0.01) {
            const damageText = new DamageText(amount, this.x, this.y - 20, accuracyLabel, isCritical, isOneShot);
            Game.effectContainer.addChild(damageText);
        }

        // 只有大鱼（价值 >= 10）显示血条，避免杂乱
        if (this.type.coin >= 10) {
            this.hpBarContainer.visible = true;
            this.hpBarContainer.alpha = 1;
            this.hpBarVisibleTimer = 90; // 显示约 1.5 秒
        }
    }

    capture() {
        if (this.captured) return;
        this.captured = true;

        // 捕获时立刻隐藏并移除血条
        if (this.hpBarContainer) {
            this.hpBarContainer.visible = false;
            if (this.hpBarContainer.parent) {
                this.hpBarContainer.parent.removeChild(this.hpBarContainer);
            }
        }

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

    destroy(options) {
        if (this.hpBarContainer) {
            if (this.hpBarContainer.parent) {
                this.hpBarContainer.parent.removeChild(this.hpBarContainer);
            }
            this.hpBarContainer.destroy();
            this.hpBarContainer = null;
        }
        super.destroy(options);
    }
}
