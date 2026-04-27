class AccuracyBar extends PIXI.Container {
    constructor() {
        super();
        this.power = 1;
        this.barWidth = 210;
        this.barHeight = 12;
        this.indicatorPos = 0.5; // 0 to 1
        this.indicatorSpeed = 0.01;
        this.indicatorDirection = 1;

        this.feedbackContainer = new PIXI.Container();
        this.addChild(this.feedbackContainer);

        this.setupGraphics();
    }

    setupGraphics() {
        this.bg = new PIXI.Graphics();
        this.yellowArea = new PIXI.Graphics();
        this.greenArea = new PIXI.Graphics();
        this.indicator = new PIXI.Graphics();

        this.addChild(this.bg);
        this.addChild(this.yellowArea);
        this.addChild(this.greenArea);
        this.addChild(this.indicator);

        this.updateVisuals();
    }

    setPower(power) {
        this.power = power;
        this.updateVisuals();
    }

    getGreenWidth() {
        // Great 区域：1号炮（0.2），7号炮（0.06）
        const maxWidth = 0.2;
        const minWidth = 0.06;
        const ratio = (this.power - 1) / 6;
        return maxWidth - (maxWidth - minWidth) * ratio;
    }

    getGoodWidth() {
        // Good 区域：1号炮（0.5），7号炮（0.15）
        const maxWidth = 0.75;
        const minWidth = 0.15;
        const ratio = (this.power - 1) / 6;
        return maxWidth - (maxWidth - minWidth) * ratio;
    }

    updateVisuals() {
        // Background
        this.bg.clear();
        this.bg.roundRect(-this.barWidth / 2, -this.barHeight / 2, this.barWidth, this.barHeight, 4);
        this.bg.fill({ color: 0xFFD700, alpha: 0 });

        // Yellow target area (Good)
        const goodWidthRatio = this.getGoodWidth();
        const yw = this.barWidth * goodWidthRatio;
        this.yellowArea.clear();
        this.yellowArea.rect(-yw / 2, -this.barHeight / 2, yw, this.barHeight, 2);
        this.yellowArea.fill({ color: 0x00ff00, alpha: 1 }); // Yellow

        // Green target area (Great)
        const greenWidthRatio = this.getGreenWidth();
        const gw = this.barWidth * greenWidthRatio;
        this.greenArea.clear();
        this.greenArea.rect(-gw / 2, -this.barHeight / 2, gw, this.barHeight, 2);
        this.greenArea.fill({ color: 0xFFFF00, alpha: 1 }); // Green

        // Render indicator based on current pos
        this.renderIndicator();
    }

    renderIndicator() {
        const x = (this.indicatorPos - 0.5) * this.barWidth;
        this.indicator.clear();
        this.indicator.rect(x - 1, -this.barHeight / 2 - 2, 4, this.barHeight + 4);
        this.indicator.fill({ color: 0xFFFFFF });
        this.indicator.stroke({ color: 0x000000, width: 1 });
    }

    update(delta) {
        this.indicatorPos += this.indicatorDirection * this.indicatorSpeed * delta;

        if (this.indicatorPos >= 1) {
            this.indicatorPos = 1;
            this.indicatorDirection = -1;
        } else if (this.indicatorPos <= 0) {
            this.indicatorPos = 0;
            this.indicatorDirection = 1;
        }

        this.renderIndicator();

        // Update feedback animations
        for (let i = this.feedbackContainer.children.length - 1; i >= 0; i--) {
            const text = this.feedbackContainer.children[i];
            text.y -= 0.5 * delta;
            text.alpha -= 0.01 * delta;
            if (text.alpha <= 0) {
                this.feedbackContainer.removeChild(text);
            }
        }
    }

    showFeedback(accuracyInfo) {
        const { label, bonus } = accuracyInfo;
        let color = "#ff0000";

        if (label === "Great") {
            color = "#ffff00";
        } else if (label === "Good") {
            color = "#00ff00";
        }

        const text = new PIXI.Text({
            text: label,
            style: {
                fill: color,
                fontSize: 18,
                fontWeight: 'bold',
                stroke: { color: 0x000000, width: 3 }
            }
        });

        text.anchor.set(0.5);
        text.y = -35;
        this.feedbackContainer.addChild(text);
    }

    getAccuracy() {
        const center = 0.5;
        const dist = Math.abs(this.indicatorPos - center);

        const halfGreen = this.getGreenWidth() / 2;
        const halfGood = this.getGoodWidth() / 2;

        if (dist <= halfGreen) {
            // Great! +25% 基础概率
            return { label: "Great", bonus: 0.25 };
        } else if (dist <= halfGood) {
            // Good! +10% 基础概率
            return { label: "Good", bonus: 0.1 };
        } else {
            // Oh~No! -50% 基础概率
            return { label: "Oh~No", bonus: -0.5 };
        }
    }
}

globalThis.AccuracyBar = AccuracyBar;
