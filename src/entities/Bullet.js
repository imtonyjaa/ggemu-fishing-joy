class Bullet extends PIXI.Sprite {
    static hitRadius = 40;
    static hitRadiusSquared = 1600;
    static defaultWebRadius = 54;

    static config = [
        { rect: [86, 0, 24, 26], regX: 12, regY: 13 },
        { rect: [61, 0, 25, 29], regX: 12, regY: 14 },
        { rect: [32, 35, 27, 31], regX: 13, regY: 15 },
        { rect: [30, 82, 29, 33], regX: 14, regY: 16 },
        { rect: [0, 82, 30, 34], regX: 15, regY: 17 },
        { rect: [30, 0, 31, 35], regX: 15, regY: 17 },
        { rect: [0, 44, 32, 38], regX: 16, regY: 19 }
    ];

    constructor(power, rotation) {
        const type = Bullet.config[power - 1];
        super(ResourceManager.getTexture("bullet", type.rect));
        this.power = power;
        this.anchor.set(type.regX / type.rect[2], type.regY / type.rect[3]);
        this.rotation = rotation;
        this.speed = 10;
        this.isDead = false;
        this.accuracyBonus = 0;
    }

    update(delta) {
        this.x += Math.cos(this.rotation - Math.PI/2) * this.speed * delta;
        this.y += Math.sin(this.rotation - Math.PI/2) * this.speed * delta;

        if (this.x < 0 || this.x > Game.width || this.y < 0 || this.y > Game.height) {
            this.isDead = true;
        }

        this.checkCollision();
    }

    checkCollision() {
        const fishes = Game.fishContainer.children;
        const bulletGlobalPos = this.getGlobalPosition();
        for (let fish of fishes) {
            if (fish.captured || fish.isDead) continue;

            const localPos = fish.toLocal(bulletGlobalPos);
            const [cx, cy, cw, ch] = fish.type.collRect || [0, 0, fish.type.width, fish.type.height];
            const minX = cx - fish.type.regX;
            const maxX = minX + cw;
            const minY = cy - fish.type.regY;
            const maxY = minY + ch;
            if (localPos.x >= minX && localPos.x <= maxX && localPos.y >= minY && localPos.y <= maxY) {
                this.hit(fish);
                break;
            }
        }
    }

    getCaptureChance(fish) {
        // 此方法已废弃，直接使用 CaptureRules.checkCapture
        return 0;
    }

    getWebRadius() {
        return Web.config[this.power - 1]?.captureRadius || Bullet.defaultWebRadius;
    }

    hit(fish) {
        this.isDead = true;
        AudioManager.playWeb();

        const web = new Web(this.power, this.x, this.y);
        Game.effectContainer.addChild(web);

        const fishes = Game.fishContainer.children;
        const webGlobalPos = this.getGlobalPosition();
        const webRadius = this.getWebRadius();
        const affectedFishes = [];

        for (let f of fishes) {
            if (f.captured || f.isDead) continue;

            const localPos = f.toLocal(webGlobalPos);
            const [cx, cy, cw, ch] = f.type.collRect || [0, 0, f.type.width, f.type.height];
            const minX = cx - f.type.regX;
            const maxX = minX + cw;
            const minY = cy - f.type.regY;
            const maxY = minY + ch;

            const checkMinX = minX - webRadius;
            const checkMaxX = maxX + webRadius;
            const checkMinY = minY - webRadius;
            const checkMaxY = maxY + webRadius;

            if (localPos.x >= checkMinX && localPos.x <= checkMaxX && localPos.y >= checkMinY && localPos.y <= checkMaxY) {
                affectedFishes.push(f);
            }
        }

        if (affectedFishes.length === 0) return;

        for (let f of affectedFishes) {
            // 根据鱼价值比例增加累积值
            f.increaseAccumulation();

            if (CaptureRules.checkCapture(this.power, f, this.accuracyBonus)) {
                f.capture();
                Game.player.addCoin(f.type.coin);
                const coinText = new CoinText(f.type.coin, f.x, f.y);
                Game.effectContainer.addChild(coinText);
            }
        }
    }
}

class Web extends PIXI.Sprite {
    static config = [
        { rect: [319, 355, 116, 118], captureRadius: 24 },
        { rect: [0, 399, 137, 142], captureRadius: 29 },
        { rect: [163, 355, 156, 162], captureRadius: 34 },
        { rect: [242, 181, 180, 174], captureRadius: 39 },
        { rect: [0, 244, 163, 155], captureRadius: 43 },
        { rect: [242, 0, 191, 181], captureRadius: 48 },
        { rect: [0, 0, 242, 244], captureRadius: 54 }
    ];

    constructor(power, x, y) {
        super(ResourceManager.getTexture("web", Web.config[power - 1].rect));
        this.anchor.set(0.5);
        this.x = x;
        this.y = y;
        this.scale.set(0.5);
        this.alpha = 0.9;
        this.timer = 0;
        this.isDead = false;
    }

    update(delta) {
        this.timer += delta;
        this.scale.x = this.scale.y = 0.48 + Math.sin(this.timer * 0.12) * 0.12;
        this.alpha = Math.max(0, 0.9 - this.timer / 34);

        if (this.timer > 30) {
            this.isDead = true;
        }
    }
}

class CoinText extends PIXI.Text {
    constructor(amount, x, y) {
        super({
            text: `+${amount}`,
            style: {
                fill: '#FFD700',
                fontSize: 28,
                fontWeight: 'bold',
                stroke: { color: 0x000000, width: 4 }
            }
        });
        this.anchor.set(0.5);
        this.x = x;
        this.y = y;
        this.timer = 0;
        this.isDead = false;
    }

    update(delta) {
        this.timer += delta;
        this.y -= 1.8 * delta;
        this.alpha = Math.max(0, 1 - this.timer / 45);

        if (this.timer > 45) {
            this.isDead = true;
        }
    }
}
