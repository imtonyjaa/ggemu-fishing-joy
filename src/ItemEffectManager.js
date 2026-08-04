class ItemEffectManager {
    static handlers = {
        bomb(game, sourceFish) {
            AudioManager.playBombExplosion();
            game.startScreenShake(36, 14);
            const defeatedCount = game.defeatAllFish(sourceFish);

            if (defeatedCount >= 2) {
                AudioManager.playMultiKill(defeatedCount);
            }
        },

        clock(game, sourceFish) {
            const duration = sourceFish.type.effectDuration || 10;
            game.freezeFish(duration);
            game.effectContainer.addChild(new ItemCountdownEffect(sourceFish, duration, true));
        },

        free(game, sourceFish) {
            const duration = sourceFish.type.effectDuration || 10;
            game.player.startFreeFire(duration);
            game.effectContainer.addChild(new ItemCountdownEffect(sourceFish, duration, true));
        }
    };

    static activate(effectName, game, sourceFish) {
        const handler = this.handlers[effectName];
        if (handler) handler(game, sourceFish);
    }
}

class ItemCountdownEffect extends PIXI.Text {
    constructor(sourceFish, durationSeconds, playTickSound = false) {
        super({
            text: `${durationSeconds}s`,
            style: {
                fill: '#FFFFFF',
                fontSize: 28,
                fontWeight: 'bold',
                stroke: { color: 0x1769AA, width: 5 }
            }
        });
        this.anchor.set(0.5);
        this.sourceFish = sourceFish;
        this.remainingFrames = durationSeconds * 60;
        this.displayedSecond = durationSeconds;
        this.playTickSound = playTickSound;
        this.isDead = false;
        this.syncPosition();
        if (this.playTickSound) AudioManager.playClockTick();
    }

    update(delta) {
        this.remainingFrames = Math.max(0, this.remainingFrames - delta);
        this.syncPosition();

        const remainingSecond = Math.ceil(this.remainingFrames / 60);
        if (remainingSecond !== this.displayedSecond) {
            this.displayedSecond = remainingSecond;
            this.text = `${remainingSecond}s`;

            if (remainingSecond > 0 && this.playTickSound) {
                AudioManager.playClockTick();
            }
        }

        if (this.remainingFrames === 0) {
            this.sourceFish.isDead = true;
            this.isDead = true;
        }
    }

    syncPosition() {
        this.position.set(
            this.sourceFish.x,
            this.sourceFish.y - this.sourceFish.type.height * 0.75
        );
    }
}

globalThis.ItemEffectManager = ItemEffectManager;
