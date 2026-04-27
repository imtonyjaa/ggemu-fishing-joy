class Player {
    constructor() {
        this.container = new PIXI.Container();
        this.localCoins = 1000;
        this.pendingBagSpend = 0;
        this.pendingBagReward = 0;
        this.bullets = [];

        this.cannon = new Cannon();
        this.cannon.x = Game.width / 2;
        this.cannon.y = Game.height - 10;
        this.container.addChild(this.cannon);

        this.accuracyBar = new AccuracyBar();
        this.setupCursorDot();
        this.container.addChild(this.accuracyBar);

        this.setupUI();
        this.bindBagState();
    }

    setupUI() {
        this.minusBtn = new PIXI.Sprite(ResourceManager.getTexture("bottom", [132, 72, 44, 31]));
        this.minusBtn.interactive = true;
        this.minusBtn.anchor.set(0.5);
        this.minusBtn.on('pointerdown', (e) => {
            e.stopPropagation();
            this.cannon.setPower(this.cannon.power - 1);
            this.accuracyBar.setPower(this.cannon.power);
            AudioManager.playUI();
        });

        this.plusBtn = new PIXI.Sprite(ResourceManager.getTexture("bottom", [44, 72, 44, 31]));
        this.plusBtn.interactive = true;
        this.plusBtn.anchor.set(0.5);
        this.plusBtn.on('pointerdown', (e) => {
            e.stopPropagation();
            this.cannon.setPower(this.cannon.power + 1);
            this.accuracyBar.setPower(this.cannon.power);
            AudioManager.playUI();
        });

        this.container.addChild(this.minusBtn, this.plusBtn);

        this.coinText = new PIXI.Text({
            text: this.getDisplayedCoins().toString().padStart(6, '0'),
            style: {
                fill: '#000000',
                fontSize: 20,
                fontWeight: 'bold',
                letterSpacing: 12
            }
        });
        this.container.addChild(this.coinText);

        this.onResize(Game.width, Game.height);
    }

    onResize(width, height) {
        this.cannon.x = width / 2 + 50;
        this.cannon.y = height - 10;

        this.minusBtn.x = width / 2 - 25;
        this.minusBtn.y = height - 35;

        this.plusBtn.x = width / 2 + 125;
        this.plusBtn.y = height - 35;

        this.accuracyBar.x = width / 2 + 268;
        this.accuracyBar.y = height - 17;

        this.coinText.x = width / 2 - 360;
        this.coinText.y = height - 27;
    }

    bindBagState() {
        if (!window.GgemuBridge) {
            return;
        }

        GgemuBridge.onBagUpdate(() => {
            this.renderCoins();
        });

        this.renderCoins();
    }

    setupCursorDot() {
        this.cursorDot = new PIXI.Graphics();
        this.cursorDot.circle(0, 0, 8);
        this.cursorDot.fill({ color: 0xFFFFFF });
        this.cursorDot.stroke({ color: 0x000000, width: 2 });
        Game.app.stage.addChild(this.cursorDot);
        this.cursorDot.visible = true;
    }

    getDisplayedCoins() {
        if (!window.GgemuBridge || !GgemuBridge.isBagEnabled()) {
            return this.localCoins;
        }

        return Math.max(0, GgemuBridge.getBagCoins() - this.pendingBagSpend + this.pendingBagReward);
    }

    renderCoins() {
        this.coinText.text = this.getDisplayedCoins().toString().padStart(6, '0');
    }

    fire(targetGlobalPos) {
        const canFire = this.consumeCoins(this.cannon.power);

        if (!canFire) return;

        const dx = targetGlobalPos.x - this.cannon.x;
        const dy = targetGlobalPos.y - this.cannon.y;
        const rotation = Math.atan2(dy, dx) + Math.PI / 2;

        this.cannon.fire(rotation);

        const accuracyInfo = this.accuracyBar.getAccuracy();
        this.accuracyBar.showFeedback(accuracyInfo);
        const bullet = new Bullet(this.cannon.power, rotation);
        bullet.accuracyBonus = accuracyInfo.bonus;
        bullet.accuracyLabel = accuracyInfo.label;
        bullet.x = this.cannon.x;
        bullet.y = this.cannon.y;
        this.bullets.push(bullet);
        Game.app.stage.addChild(bullet);

        Game.coinsSpentSinceLastSchool = (Game.coinsSpentSinceLastSchool || 0) + this.cannon.power;
    }

    consumeCoins(amount) {
        if (!window.GgemuBridge || !GgemuBridge.isBagEnabled()) {
            if (this.localCoins < amount) {
                return false;
            }

            this.localCoins -= amount;
            this.renderCoins();
            return true;
        }

        if (this.getDisplayedCoins() < amount) {
            return false;
        }

        this.pendingBagSpend += amount;
        this.renderCoins();

        GgemuBridge.useCoins(amount)
            .catch((error) => {
                console.warn('[GGEMU] spend coins failed:', error && error.message ? error.message : error);
            })
            .finally(() => {
                this.pendingBagSpend = Math.max(0, this.pendingBagSpend - amount);
                this.renderCoins();
            });

        return true;
    }

    addCoin(amount) {
        if (amount <= 0) {
            return;
        }

        if (!window.GgemuBridge || !GgemuBridge.isBagEnabled()) {
            this.localCoins += amount;
            this.renderCoins();
            AudioManager.playBubble();
            return;
        }

        this.pendingBagReward += amount;
        this.renderCoins();
        AudioManager.playBubble();

        GgemuBridge.addCoins(amount)
            .catch((error) => {
                console.warn('[GGEMU] add coins failed:', error && error.message ? error.message : error);
            })
            .finally(() => {
                this.pendingBagReward = Math.max(0, this.pendingBagReward - amount);
                this.renderCoins();
            });
    }

    updateBullets(delta) {
        // 更新准度条
        this.accuracyBar.update(delta);

        // 更新鼠标跟随小圆点和炮台转向
        const mousePos = Game.app.renderer.events.pointer.global;
        if (mousePos) {
            this.cursorDot.position.set(mousePos.x + 30, mousePos.y + 30);

            // 更新炮台旋转
            const dx = mousePos.x - this.cannon.x;
            const dy = mousePos.y - this.cannon.y;
            this.cannon.rotation = Math.atan2(dy, dx) + Math.PI / 2;

            // 根据当前准度实时更新颜色
            const accuracy = this.accuracyBar.getAccuracy();
            let color = 0xFF0000; // 默认红色 (Oh~No)
            if (accuracy.label === "Great") color = 0xFFFF00; // 黄色
            else if (accuracy.label === "Good") color = 0x00FF00; // 绿色

            this.cursorDot.clear();
            this.cursorDot.circle(0, 0, 8);
            this.cursorDot.fill({ color: color });
        }

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(delta);
            if (b.isDead) {
                Game.app.stage.removeChild(b);
                this.bullets.splice(i, 1);
            }
        }
    }
}
