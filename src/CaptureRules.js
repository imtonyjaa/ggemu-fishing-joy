class CaptureRules {
    static highPowerCap = 0.9;
    
    // 预生成的随机数表，用于“自然随机”分布
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
        let rtpMultiplier = 1.1; 
        if (c > 5) {
            // 在 5-50 价值之间从 1.1 降至 0.6
            const t = Math.min(1, (c - 5) / 45);
            rtpMultiplier = 1.1 - t * (1.1 - 0.6);
        } else if (c > 50) {
            rtpMultiplier = 0.6;
        }
        return rtpMultiplier;
    }

    static getSingleCaptureChance({ bulletPower, fishCoin, accuracyBonusFactor = 0, captureAccumulationFactor = 0 }) {
        const p = Number(bulletPower || 0);
        const c = Number(fishCoin || 1);

        if (p <= 0 || c <= 0) return 0;

        // 1. 计算动态 RTP 系数
        const rtpMultiplier = this.getRtpMultiplier(c);
        
        // 2. 计算基础概率
        const baseProb = (p / c) * rtpMultiplier;

        // 3. 最终概率 = 基础概率 * (1 + 准度加成因子 + 累积因子)
        let captureChance = baseProb * (1 + accuracyBonusFactor + captureAccumulationFactor);

        // 限制范围在 [0, highPowerCap]
        captureChance = Math.max(0, Math.min(captureChance, CaptureRules.highPowerCap));

        return captureChance;
    }

    static checkCapture(bulletPower, fish, accuracyBonusFactor = 0) {
        const prob = this.getSingleCaptureChance({
            bulletPower,
            fishCoin: fish.type.coin,
            accuracyBonusFactor,
            captureAccumulationFactor: fish.captureAccumulationFactor || 0
        });

        return this.naturalRandom() < prob;
    }

    static getFishCaptureChance(bulletPower, fishType = {}, accuracyMult = 1.0) {
        // 兼容旧调用
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
