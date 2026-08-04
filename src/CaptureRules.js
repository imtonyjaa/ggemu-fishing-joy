class CaptureRules {
    static highPowerCap = 0.9; // Cap for capture chance even with all bonuses, to keep some level of uncertainty.
    static lowCoinThreshold = 20; // Threshold for considering a player to be in "low coin" state, which can trigger certain bonuses or increased chances.
    static lowCoinAssistBonusFactor = 2.0; // Additional bonus factor applied to capture chance for low coin players, to help them recover. This is a multiplier on top of other bonuses, not a flat increase.
    static oneShotChance = 0.15; // Base chance for a one-shot capture after a mega critical hit.
    static lowCoinOneShotChance = 0.2; // Conditional one-shot chance after a mega critical hit for low coin players.
    static lowCoinRescueOneShotChance = { // Additional one-shot chance for low coin players based on accuracy, to provide a potential "rescue" capture even without a mega critical hit. This is separate from the mega critical one-shot chance and can trigger independently.
        Great: 0.03,
        Good: 0.01
    };
    
    // Precomputed random table for smoother natural randomness.
    static _randomTable = [];
    static _randomIndex = 0;
    static _tableSize = 1000;

    static init() {
        this._randomTable = Array.from({ length: this._tableSize }, () => Math.random());
        this.shuffleTable();
    }

    static shuffleTable() {
        for (let i = this._randomTable.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this._randomTable[i], this._randomTable[j]] = [this._randomTable[j], this._randomTable[i]];
        }
    }

    static naturalRandom() {
        if (this._randomTable.length === 0) this.init();
        const value = this._randomTable[this._randomIndex];
        this._randomIndex = (this._randomIndex + 1) % this._tableSize;
        if (this._randomIndex === 0) this.shuffleTable();
        return value;
    }

    static getRtpMultiplier(c) {
        if (c <= 5) return 1.1;

        const t = Math.min(1, (c - 5) / 45);
        return 1.1 - t * (1.1 - 0.6);
    }

    static isLowCoin(playerCoins) {
        const coins = Number(playerCoins);
        return Number.isFinite(coins) && coins < this.lowCoinThreshold;
    }

    static getLowCoinAssistBonusFactor(playerCoins) {
        return this.isLowCoin(playerCoins) ? this.lowCoinAssistBonusFactor : 0;
    }

    static getFinalOneShotChance(playerCoins) {
        if (this.isLowCoin(playerCoins)) {
            return this.lowCoinOneShotChance;
        }

        return this.oneShotChance;
    }

    static getOneShotChance(playerCoins) {
        return this.getFinalOneShotChance(playerCoins);
    }

    static getRescueOneShotChance(playerCoins, accuracyLabel) {
        if (!this.isLowCoin(playerCoins)) return 0;

        return this.lowCoinRescueOneShotChance[accuracyLabel] || 0;
    }

    static getMegaCriticalChance({ bulletPower, fishCoin, accuracyLabel, accuracyBonusFactor = 0, captureAccumulationFactor = 0, playerCoins = null }) {
        if (accuracyLabel !== "Great" && accuracyLabel !== "Good") return 0;

        return this.getSingleCaptureChance({
            bulletPower,
            fishCoin,
            accuracyBonusFactor,
            captureAccumulationFactor,
            playerCoins
        });
    }

    static getAccuracyDamageMultiplier(accuracyLabel) {
        if (accuracyLabel === "Great") return 2.0;
        if (accuracyLabel === "Good") return 1.0;
        return 0.5;
    }

    static getMegaCriticalDamage(baseDamage, fishMaxHp) {
        const baseMegaDamage = fishMaxHp * (0.4 + Math.random() * 0.4);
        return Math.max(baseDamage * 10, baseMegaDamage);
    }

    static getHitOutcome({ bulletPower, fishCoin, fishHp, fishMaxHp, accuracyLabel, accuracyBonusFactor = 0, captureAccumulationFactor = 0, playerCoins = null, allowOneShot = true }) {
        let damage = bulletPower * this.getAccuracyDamageMultiplier(accuracyLabel);
        const megaCriticalChance = this.getMegaCriticalChance({
            bulletPower,
            fishCoin,
            accuracyLabel,
            accuracyBonusFactor,
            captureAccumulationFactor,
            playerCoins
        });

        let isMegaCritical = false;
        let isOneShot = false;

        if (megaCriticalChance > 0 && this.naturalRandom() < megaCriticalChance) {
            isMegaCritical = true;

            if (allowOneShot && this.naturalRandom() < this.getOneShotChance(playerCoins)) {
                damage = fishHp;
                isOneShot = true;
            } else {
                damage = this.getMegaCriticalDamage(damage, fishMaxHp);
            }
        } else if (allowOneShot) {
            const rescueOneShotChance = this.getRescueOneShotChance(playerCoins, accuracyLabel);
            if (rescueOneShotChance > 0 && this.naturalRandom() < rescueOneShotChance) {
                damage = fishHp;
                isOneShot = true;
            }
        }

        if (isOneShot) {
            damage = fishHp;
        }

        return { damage, isMegaCritical, isOneShot, megaCriticalChance };
    }

    static getSingleCaptureChance({ bulletPower, fishCoin, accuracyBonusFactor = 0, captureAccumulationFactor = 0, playerCoins = null }) {
        const p = Number(bulletPower || 0);
        const c = Number(fishCoin || 1);

        if (p <= 0 || c <= 0) return 0;

        const rtpMultiplier = this.getRtpMultiplier(c);
        
        const baseProb = (p / c) * rtpMultiplier;

        // Final chance = base chance * all bonus factors.
        const lowCoinAssistBonusFactor = this.getLowCoinAssistBonusFactor(playerCoins);
        let captureChance = baseProb * (1 + accuracyBonusFactor + captureAccumulationFactor + lowCoinAssistBonusFactor);

        // Keep chance inside the configured cap.
        captureChance = Math.max(0, Math.min(captureChance, CaptureRules.highPowerCap));

        return captureChance;
    }

    static checkCapture(bulletPower, fish, accuracyBonusFactor = 0, playerCoins = null) {
        const prob = this.getSingleCaptureChance({
            bulletPower,
            fishCoin: fish.type.coin,
            accuracyBonusFactor,
            captureAccumulationFactor: fish.captureAccumulationFactor || 0,
            playerCoins
        });

        return this.naturalRandom() < prob;
    }

    static getFishCaptureChance(bulletPower, fishType = {}, accuracyMult = 1.0) {
        // Keep compatibility with older call sites.
        return this.getSingleCaptureChance({
            bulletPower,
            fishCoin: fishType.coin,
            accuracyBonusFactor: (accuracyMult - 1),
            captureAccumulationFactor: 0
        });
    }
}

CaptureRules.init();
globalThis.CaptureRules = CaptureRules;
