const Game = {
    schoolGuaranteedCost: 160,
    schoolRandomChance: 0.001,
    schoolCooldownAfterSpawn: 320,
    app: null,
    width: 0,
    height: 0,
    fishContainer: null,
    uiContainer: null,
    player: null,
    fishManager: null,
    spawnCooldown: 0,
    recentSpawnMarks: [],
    lastSpawnTypeIndex: 0,
    repeatedSpawnTypeCount: 0,
    lastSpawnSide: '',
    repeatedSpawnSideCount: 0,
    schoolSpawnQueue: [],
    schoolSpawnCooldown: 0,
    schoolEventCooldown: 0,
    openingSchoolPending: false,
    schoolSpawnMode: 'normal',
    isLiveMode: false,
    fishFreezeTimer: 0,
    fishVortexTimer: 0,
    fishVortexSource: null,
    screenShakeTimer: 0,
    screenShakeDuration: 0,
    screenShakeIntensity: 0,

    async init() {
        this.app = new PIXI.Application();
        await this.app.init({
            resizeTo: window,
            backgroundColor: 0x000000,
            antialias: false,
            autoStart: true,
            preference: 'webgl',
            powerPreference: 'high-performance',
            autoDensity: true,
            preserveDrawingBuffer: true,
            resolution: Math.min(window.devicePixelRatio || 1, 1.25)
        });
        this.app.canvas.style.display = 'block';
        document.getElementById('game-container').appendChild(this.app.canvas);

        this.width = this.app.screen.width;
        this.height = this.app.screen.height;

        try {
            await ResourceManager.load();
        } catch (e) {
            console.error("资源加载失败:", e);
        }

        this.setupGroups();
        this.setupEvents();
        this.resetSpawnState();
        AudioManager.init();
        GgemuBridge.onLiveStateChange((active) => {
            this.setLiveMode(active);
        });

        this.app.render();

        this.app.ticker.add(this.update, this);
        this.app.ticker.maxFPS = 60;

        window.addEventListener('resize', () => this.onResize());

        this.onResize();
        setTimeout(() => this.onResize(), 100);

        GgemuBridge.init({
            gameId: 'sdk-fishcannon',
            canvas: this.app.canvas,
            audioNode: AudioManager.getOutputNode()
        });
    },

    resetSpawnState() {
        this.spawnCooldown = 20;
        this.recentSpawnMarks = [];
        this.lastSpawnTypeIndex = 0;
        this.repeatedSpawnTypeCount = 0;
        this.lastSpawnSide = '';
        this.repeatedSpawnSideCount = 0;
        this.schoolSpawnQueue = [];
        this.schoolSpawnCooldown = 0;
        this.schoolEventCooldown = 140;
        this.openingSchoolPending = true;
        this.schoolSpawnMode = 'normal';
        this.coinsSpentSinceLastSchool = 0;
    },

    onResize() {
        this.width = this.app.screen.width;
        this.height = this.app.screen.height;

        this.background.width = this.width;
        this.background.height = this.height;

        if (WaterEffect.overlaySprite) {
            WaterEffect.overlaySprite.width = this.width;
            WaterEffect.overlaySprite.height = this.height;
        }
        if (WaterEffect.displacementSprite) {
            WaterEffect.displacementSprite.width = this.width;
            WaterEffect.displacementSprite.height = this.height;
        }

        this.bottomBar.x = this.width / 2;
        this.bottomBar.y = this.height;

        this.player.onResize(this.width, this.height);

        this.app.stage.hitArea = this.app.screen;
    },

    setLiveMode(active) {
        this.isLiveMode = Boolean(active);

        if (this.app && this.app.ticker) {
            this.app.ticker.maxFPS = 60;
        }
    },

    setupGroups() {
        this.gameContainer = new PIXI.Container();
        this.app.stage.addChild(this.gameContainer);

        this.background = new PIXI.Sprite(ResourceManager.textures.mainbg);
        this.background.width = this.width;
        this.background.height = this.height;
        this.gameContainer.addChild(this.background);

        this.fishContainer = new PIXI.Container();
        this.gameContainer.addChild(this.fishContainer);

        WaterEffect.init(this.app, this.width, this.height);
        this.gameContainer.filters = [WaterEffect.displacementFilter];

        if (WaterEffect.overlaySprite) {
            this.app.stage.addChild(WaterEffect.overlaySprite);
        }

        this.effectContainer = new PIXI.Container();
        this.app.stage.addChild(this.effectContainer);

        this.uiContainer = new PIXI.Container();
        this.app.stage.addChild(this.uiContainer);

        this.bottomBar = new PIXI.Sprite(ResourceManager.getTexture("bottom", [0, 0, 765, 72]));
        this.bottomBar.anchor.set(0.5, 1);
        this.bottomBar.x = this.width / 2;
        this.bottomBar.y = this.height;
        this.uiContainer.addChild(this.bottomBar);

        this.player = new Player();
        this.uiContainer.addChild(this.player.container);
    },

    setupEvents() {
        this.app.stage.interactive = true;
        this.app.stage.hitArea = this.app.screen;

        this.app.stage.on('pointerdown', (e) => {
            AudioManager.startAmbient();
            Promise.resolve(this.player.fire(e.global)).catch((error) => {
                console.warn('Fire failed:', error);
            });
        });
    },

    update(ticker) {
        if (this.width !== this.app.screen.width || this.height !== this.app.screen.height) {
            this.onResize();
        }

        const delta = ticker.deltaTime;

        WaterEffect.update(delta);
        this.updateScreenShake(delta);

        const fishAreFrozen = this.updateFishFreeze(delta);
        const fishVortexSource = this.updateFishVortex(delta);

        if (!fishAreFrozen) {
            this.updateSpawnSystem(delta);
        }

        for (let i = this.fishContainer.children.length - 1; i >= 0; i--) {
            const fish = this.fishContainer.children[i];
            fish.update(delta, fishAreFrozen, fishVortexSource);
            if (fish.isDead) {
                this.fishContainer.removeChild(fish);
                fish.destroy();
            }
        }

        for (let i = this.effectContainer.children.length - 1; i >= 0; i--) {
            const effect = this.effectContainer.children[i];

            if (typeof effect.update === 'function') {
                effect.update(delta);
            }

            if (effect.isDead) {
                this.effectContainer.removeChild(effect);
            }
        }

        this.player.updateBullets(delta);
    },

    freezeFish(seconds) {
        this.fishFreezeTimer = Math.max(this.fishFreezeTimer, seconds * 60);
    },

    updateFishFreeze(delta) {
        if (this.fishFreezeTimer <= 0) return false;

        this.fishFreezeTimer = Math.max(0, this.fishFreezeTimer - delta);
        return true;
    },

    startFishVortex(sourceFish, seconds) {
        this.fishVortexSource = sourceFish;
        this.fishVortexTimer = Math.max(this.fishVortexTimer, seconds * 60);
    },

    updateFishVortex(delta) {
        if (this.fishVortexTimer <= 0 || !this.fishVortexSource) {
            this.fishVortexSource = null;
            return null;
        }

        const sourceFish = this.fishVortexSource;
        this.fishVortexTimer = Math.max(0, this.fishVortexTimer - delta);
        return sourceFish;
    },

    startScreenShake(duration, intensity) {
        this.screenShakeTimer = Math.max(this.screenShakeTimer, duration);
        this.screenShakeDuration = Math.max(this.screenShakeDuration, duration);
        this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    },

    updateScreenShake(delta) {
        if (this.screenShakeTimer <= 0) {
            this.gameContainer.position.set(0, 0);
            return;
        }

        this.screenShakeTimer = Math.max(0, this.screenShakeTimer - delta);
        const strength = this.screenShakeIntensity * (this.screenShakeTimer / this.screenShakeDuration);
        this.gameContainer.position.set(
            (Math.random() * 2 - 1) * strength,
            (Math.random() * 2 - 1) * strength
        );

        if (this.screenShakeTimer === 0) {
            this.gameContainer.position.set(0, 0);
            this.screenShakeDuration = 0;
            this.screenShakeIntensity = 0;
        }
    },

    defeatFish(fish) {
        if (!fish || fish.captured || fish.isDead) return false;

        fish.capture();

        if (fish.type.itemEffect) {
            ItemEffectManager.activate(fish.type.itemEffect, this, fish);
            return true;
        }

        if (fish.type.coin > 0) {
            this.player.addCoin(fish.type.coin);
            const coinText = new CoinText(fish.type.coin, this.width / 2 - 340, this.height - 40);
            this.effectContainer.addChild(coinText);
        }

        return true;
    },

    defeatAllFish(sourceFish) {
        const fishes = [...this.fishContainer.children];
        let defeatedCount = 0;

        for (const fish of fishes) {
            if (fish === sourceFish || !fish.hasEnteredScreen) continue;
            if (this.defeatFish(fish)) defeatedCount++;
        }

        return defeatedCount;
    },

    updateSpawnSystem(delta) {
        this.updateRecentSpawnMarks(delta);
        this.schoolEventCooldown = Math.max(0, this.schoolEventCooldown - delta);

        if (this.openingSchoolPending && this.schoolSpawnQueue.length === 0 && this.fishContainer.children.length === 0) {
            this.queueOpeningFishSchool();
            this.openingSchoolPending = false;
            this.spawnQueuedSchoolFish(this.schoolSpawnQueue.length);
            return;
        }

        if (this.schoolSpawnQueue.length > 0) {
            this.spawnQueuedSchoolFish(this.schoolSpawnQueue.length);
            this.spawnCooldown = 60;
            return;
        }

        if (this.shouldStartFishSchool()) {
            this.queueFishSchool();
            this.schoolSpawnCooldown = 0;
            this.spawnCooldown = this.getNextSpawnCooldown() + 12;
            return;
        }

        if (this.fishContainer.children.length >= this.getMaxFishCount()) {
            this.spawnCooldown = Math.min(this.spawnCooldown, 12);
            return;
        }

        this.spawnCooldown -= delta;

        if (this.spawnCooldown > 0) {
            return;
        }

        this.spawnFish();
        this.spawnCooldown = this.getNextSpawnCooldown();
    },

    updateRecentSpawnMarks(delta) {
        this.recentSpawnMarks = this.recentSpawnMarks.filter((mark) => {
            mark.ttl -= delta;
            return mark.ttl > 0;
        });
    },

    getMaxFishCount() {
        const densityBase = Math.round(Math.min(this.width / 320, this.height / 180)) + 8;
        const maxFishCount = Math.max(20, Math.min(20, densityBase));

        return maxFishCount;
    },

    getNextSpawnCooldown() {
        const maxFishCount = this.getMaxFishCount();
        const currentFishCount = this.fishContainer.children.length;
        const occupancy = maxFishCount > 0 ? currentFishCount / maxFishCount : 0;
        const minDelay = occupancy > 0.7 ? 26 : 18;
        const maxDelay = occupancy > 0.7 ? 48 : 34;

        return minDelay + Math.random() * (maxDelay - minDelay);
    },

    getSchoolSpawnCooldown() {
        if (this.schoolSpawnMode === 'opening') {
            return this.isLiveMode ? 2.5 : 2;
        }

        return this.isLiveMode ? 4.5 : 3.5;
    },

    chooseSpawnSide() {
        if (!this.lastSpawnSide) {
            return Math.random() > 0.5 ? 'left' : 'right';
        }

        if (this.repeatedSpawnSideCount >= 1) {
            return this.lastSpawnSide === 'left' ? 'right' : 'left';
        }

        if (Math.random() < 0.65) {
            return this.lastSpawnSide === 'left' ? 'right' : 'left';
        }

        return this.lastSpawnSide;
    },

    chooseFishTypeIndex() {
        // 确保屏幕上同时只会出现一条鲨鱼，包括正在播放捕获动画的鲨鱼
        const hasShark = this.fishContainer.children.some(f => !f.isDead && (f.typeIndex === 11 || f.typeIndex === 12));
        const hasItem = this.fishContainer.children.some(f => !f.isDead && Boolean(f.type.itemEffect));

        const candidates = [
            { typeIndex: 1, weight: 65 },
            { typeIndex: 2, weight: 55 },
            { typeIndex: 3, weight: 45 },
            { typeIndex: 4, weight: 40 },
            { typeIndex: 5, weight: 35 },
            { typeIndex: 6, weight: 25 },
            { typeIndex: 7, weight: 20 },
            { typeIndex: 8, weight: 10 },
            { typeIndex: 9, weight: 3 },
            { typeIndex: 10, weight: 2 },
            { typeIndex: 11, weight: hasShark ? 0 : 5 }, // 调整鲨鱼权重，增加出现频率
            { typeIndex: 12, weight: hasShark ? 0 : 2 },
            { typeIndex: 13, weight: hasItem ? 0 : 2 },
            { typeIndex: 14, weight: hasItem ? 0 : 2 },
            { typeIndex: 15, weight: hasItem ? 0 : 2 },
            { typeIndex: 16, weight: hasItem ? 0 : 2 },
            { typeIndex: 17, weight: hasItem ? 0 : 2 }
        ];

        let totalWeight = 0;

        for (const candidate of candidates) {
            // 只有当初始权重大于0时，才进行连续生成的概率衰减逻辑
            if (candidate.weight > 0 && candidate.typeIndex === this.lastSpawnTypeIndex) {
                candidate.weight = this.repeatedSpawnTypeCount >= 1
                    ? 0
                    : Math.max(2, Math.floor(candidate.weight * 0.35));
            }

            totalWeight += candidate.weight;
        }

        let roll = Math.random() * totalWeight;

        for (const candidate of candidates) {
            roll -= candidate.weight;
            if (roll <= 0) {
                return candidate.typeIndex;
            }
        }

        return candidates[0].typeIndex;
    },

    chooseSpawnY(typeIndex, side) {
        const fishType = Fish.types[typeIndex];
        const topPadding = 80 + fishType.height * 0.35;
        const bottomPadding = 125 + fishType.height * 0.4;
        const minY = topPadding;
        const maxY = Math.max(minY + 20, this.height - bottomPadding);
        let bestY = (minY + maxY) / 2;
        let bestScore = -Infinity;

        for (let i = 0; i < 8; i++) {
            const candidateY = minY + Math.random() * (maxY - minY);
            let score = 1000 - Math.abs(candidateY - this.height * 0.45) * 0.08;

            for (const mark of this.recentSpawnMarks) {
                if (mark.side !== side) {
                    continue;
                }

                const gap = Math.abs(candidateY - mark.y);
                const idealGap = Math.max(90, (fishType.height + mark.height) * 0.45);
                score = Math.min(score, gap - idealGap);

                if (mark.typeIndex === typeIndex) {
                    score -= 24;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestY = candidateY;
            }
        }

        return bestY;
    },

    shouldStartFishSchool() {
        if (this.coinsSpentSinceLastSchool >= this.schoolGuaranteedCost) {
            if (this.fishContainer.children.length <= this.getMaxFishCount() - 3) {
                this.coinsSpentSinceLastSchool = 0;
                return true;
            }
        }

        if (this.schoolEventCooldown > 0) {
            return false;
        }

        if (this.fishContainer.children.length > this.getMaxFishCount() - 3) {
            return false;
        }

        if (Math.random() < this.schoolRandomChance) {
            this.coinsSpentSinceLastSchool = 0;
            return true;
        }

        return false;
    },

    queueFishSchool() {
        this.schoolSpawnMode = 'normal';
        const waveKinds = ['standard', 'fast', 'escort'];
        const selectedWaveKind = waveKinds[Math.floor(Math.random() * waveKinds.length)];

        if (selectedWaveKind === 'fast') {
            this.queueFastFishSchool();
            return;
        }

        if (selectedWaveKind === 'escort') {
            this.queueEscortFormation();
            return;
        }

        this.queueStandardFishSchool();
    },

    queueOpeningFishSchool() {
        this.schoolSpawnMode = 'opening';

        const debugGroup = '';
        const debugIndex = 0;

        const candidates = FishFormation.SCHOOL_FORMATIONS[debugGroup];
        if (!candidates || candidates.length === 0) return;

        const formationConfig = candidates[debugIndex] || candidates[0];
        console.log("[Debug] 硬编码触发测试阵列:", formationConfig.key);

        const members = this.buildMembersFromFormationConfig(formationConfig);

        if (members.length === 0) {
            this.schoolSpawnQueue = [];
            return;
        }

        const side = this.chooseSpawnSide();
        const anchorTypeIndex = members[Math.floor(members.length / 2)]?.typeIndex || members[0]?.typeIndex || 1;
        const baseY = this.chooseSpawnY(anchorTypeIndex, side);

        this.buildSchoolSpawnQueue({
            members,
            side,
            baseY,
            directionOffsetFactor: typeof formationConfig.directionOffsetFactor === 'number' ? formationConfig.directionOffsetFactor : 0.16,
            angleJitterRange: typeof formationConfig.angleJitterRange === 'number' ? formationConfig.angleJitterRange : 0.05
        });

        const cooldownMin = typeof formationConfig.cooldownMin === 'number' ? formationConfig.cooldownMin : 260;
        const cooldownRange = typeof formationConfig.cooldownRange === 'number' ? formationConfig.cooldownRange : 120;
        this.schoolEventCooldown = Math.max(
            this.schoolCooldownAfterSpawn,
            cooldownMin + Math.random() * cooldownRange
        );
    },

    spawnQueuedSchoolFish(limit = 1) {
        let remaining = Math.max(1, limit);

        while (remaining > 0 && this.schoolSpawnQueue.length > 0) {
            const nextSchoolSpawn = this.schoolSpawnQueue.shift();
            this.spawnFish(nextSchoolSpawn);
            remaining -= 1;
        }

        if (this.schoolSpawnQueue.length === 0) {
            this.schoolSpawnMode = 'normal';
        }
    },

    pickFormationConfig(groupName) {
        const candidates = FishFormation.SCHOOL_FORMATIONS[groupName];

        if (!Array.isArray(candidates) || candidates.length === 0) {
            return null;
        }

        const fishConfig = candidates[Math.floor(Math.random() * candidates.length)] || null;
        console.log("fishConfig:", fishConfig.key);
        return fishConfig;
    },

    buildMembersFromFormationConfig(formationConfig) {
        const grid = Array.isArray(formationConfig?.grid) ? formationConfig.grid : [];

        if (grid.length === 0) {
            return [];
        }

        const rowCount = grid.length;
        const colCount = Math.max(...grid.map((row) => Array.isArray(row) ? row.length : 0), 0);
        const centerRow = Math.floor(rowCount / 2);
        const maxColIndex = Math.max(0, colCount - 1);
        const cells = [];

        for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
            const row = Array.isArray(grid[rowIndex]) ? grid[rowIndex] : [];

            for (let colIndex = 0; colIndex < colCount; colIndex++) {
                const typeIndex = Number(row[colIndex] || 0);

                if (!typeIndex || !Fish.types[typeIndex]) {
                    continue;
                }

                cells.push({
                    rowIndex,
                    colIndex,
                    typeIndex,
                });
            }
        }

        if (cells.length === 0) {
            return [];
        }

        let maxFishSize = 0;

        for (const cell of cells) {
            const fishType = Fish.types[cell.typeIndex];
            maxFishSize = Math.max(maxFishSize, fishType.width, fishType.height);
        }

        const spacingScale = typeof formationConfig.spacingScale === 'number' ? formationConfig.spacingScale : 0.8;
        const verticalSpacingScale = typeof formationConfig.verticalSpacingScale === 'number' ? formationConfig.verticalSpacingScale : 0.9;

        const spacingX = Math.max(48, maxFishSize * spacingScale);
        const spacingY = Math.max(48, maxFishSize * verticalSpacingScale);

        const targetSpeed = typeof formationConfig.targetSpeed === 'number' ? formationConfig.targetSpeed : 0;
        const defaultSpeedMultiplier = typeof formationConfig.speedMultiplier === 'number' ? formationConfig.speedMultiplier : 1;
        const defaultAnimationSpeedMultiplier = typeof formationConfig.animationSpeedMultiplier === 'number'
            ? formationConfig.animationSpeedMultiplier
            : 1;

        cells.sort((leftCell, rightCell) => {
            if (leftCell.colIndex !== rightCell.colIndex) {
                return rightCell.colIndex - leftCell.colIndex;
            }

            return Math.abs(leftCell.rowIndex - centerRow) - Math.abs(rightCell.rowIndex - centerRow);
        });

        return cells.map((cell) => {
            const fishType = Fish.types[cell.typeIndex];
            const offsetX = (maxColIndex - cell.colIndex) * spacingX;
            const offsetY = (cell.rowIndex - centerRow) * spacingY;
            const speedMultiplier = targetSpeed > 0
                ? targetSpeed / fishType.speed
                : defaultSpeedMultiplier;

            return {
                typeIndex: cell.typeIndex,
                offsetX,
                offsetY,
                speedMultiplier,
                animationSpeedMultiplier: defaultAnimationSpeedMultiplier,
            };
        });
    },

    buildSchoolSpawnQueue({ members, side, baseY, directionOffsetFactor = 0.16, angleJitterRange = 0.05 }) {
        if (!Array.isArray(members) || members.length === 0) {
            this.schoolSpawnQueue = [];
            return;
        }

        const topLimit = 70;
        const bottomLimit = this.height - 130;
        const minYOffset = Math.min(...members.map((entry) => entry.offsetY - Fish.types[entry.typeIndex].height * 0.45));
        const maxYOffset = Math.max(...members.map((entry) => entry.offsetY + Fish.types[entry.typeIndex].height * 0.45));
        const clampedBaseY = Math.max(
            topLimit - minYOffset,
            Math.min(bottomLimit - maxYOffset, baseY)
        );
        const directionOffset = (clampedBaseY / Math.max(this.height, 1) - 0.5) * directionOffsetFactor;
        const rotation = side === 'left'
            ? -directionOffset
            : Math.PI - directionOffset;
        const sharedTurnSpeed = (Math.random() - 0.5) * 0.001;

        this.schoolSpawnQueue = members.map((entry, index) => ({
            typeIndex: entry.typeIndex,
            side,
            y: clampedBaseY + entry.offsetY,
            rotation,
            spawnOffset: 96 + Math.abs(entry.offsetX),
            speedMultiplier: entry.speedMultiplier || 1,
            animationSpeedMultiplier: entry.animationSpeedMultiplier || 1,
            turnSpeed: sharedTurnSpeed
        }));
    },

    queueFormationFromConfig(groupName) {
        const formationConfig = this.pickFormationConfig(groupName);

        if (!formationConfig) {
            this.schoolSpawnQueue = [];
            return;
        }

        const members = this.buildMembersFromFormationConfig(formationConfig);

        if (members.length === 0) {
            this.schoolSpawnQueue = [];
            return;
        }

        const side = this.chooseSpawnSide();
        const anchorTypeIndex = members[Math.floor(members.length / 2)]?.typeIndex || members[0]?.typeIndex || 1;
        const baseY = this.chooseSpawnY(anchorTypeIndex, side);

        this.buildSchoolSpawnQueue({
            members,
            side,
            baseY,
            directionOffsetFactor: typeof formationConfig.directionOffsetFactor === 'number' ? formationConfig.directionOffsetFactor : 0.16,
            angleJitterRange: typeof formationConfig.angleJitterRange === 'number' ? formationConfig.angleJitterRange : 0.05
        });
        const cooldownMin = typeof formationConfig.cooldownMin === 'number' ? formationConfig.cooldownMin : 260;
        const cooldownRange = typeof formationConfig.cooldownRange === 'number' ? formationConfig.cooldownRange : 120;
        this.schoolEventCooldown = Math.max(
            this.schoolCooldownAfterSpawn,
            cooldownMin + Math.random() * cooldownRange
        );
    },

    queueStandardFishSchool() {
        this.queueFormationFromConfig('standard');
    },

    queueFastFishSchool() {
        this.queueFormationFromConfig('fast');
    },

    queueEscortFormation() {
        this.queueFormationFromConfig('escort');
    },

    recordSpawn(typeIndex, side, y) {
        this.recentSpawnMarks.push({
            typeIndex,
            side,
            y,
            height: Fish.types[typeIndex].height,
            ttl: 90 + Math.random() * 20
        });

        if (typeIndex === this.lastSpawnTypeIndex) {
            this.repeatedSpawnTypeCount += 1;
        } else {
            this.lastSpawnTypeIndex = typeIndex;
            this.repeatedSpawnTypeCount = 0;
        }

        if (side === this.lastSpawnSide) {
            this.repeatedSpawnSideCount += 1;
        } else {
            this.lastSpawnSide = side;
            this.repeatedSpawnSideCount = 0;
        }
    },

    spawnFish(spawnOptions = null) {
        const fishTypeIndex = spawnOptions?.typeIndex || this.chooseFishTypeIndex();
        const side = spawnOptions?.side || this.chooseSpawnSide();
        const y = typeof spawnOptions?.y === 'number'
            ? spawnOptions.y
            : this.chooseSpawnY(fishTypeIndex, side);
        const directionOffset = (y / Math.max(this.height, 1) - 0.5) * 0.18;
        const angleJitter = Math.random() * 0.18 - 0.09;
        const rotation = typeof spawnOptions?.rotation === 'number'
            ? spawnOptions.rotation
            : side === 'left'
                ? -directionOffset + angleJitter
                : Math.PI - directionOffset + angleJitter;
        const fish = new Fish(fishTypeIndex, {
            side,
            y,
            rotation,
            spawnOffset: spawnOptions?.spawnOffset || (100 + Math.random() * 80),
            speedMultiplier: spawnOptions?.speedMultiplier || 1,
            animationSpeedMultiplier: spawnOptions?.animationSpeedMultiplier || 1,
            turnSpeed: spawnOptions?.turnSpeed
        });

        this.fishContainer.addChild(fish);
        this.recordSpawn(fishTypeIndex, side, y);
    }
};

window.onload = () => {
    Game.init();
};
