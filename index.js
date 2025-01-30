const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth - 40;
canvas.height = window.innerHeight - 40;

const CELL_TYPES = {
    AMOEBA: {
        type: "Mov. Ameboide",
        color: "#8B008B",
        size: 30,
        baseSpeed: 1
    },
    FLAGELLATE: {
        type: "Mov. Flagelar",
        color: "#000080",
        size: 15,
        baseSpeed: 2
    },
    MUSCLE: {
        type: "Mov. Contração",
        color: "#8B0000",
        size: 20
    },
    BACTERIUM: {
        type: "Mov. Browniano",
        color: "#FFD700",
        size: 8,
        health: 100
    },
    CILIATE: {
        type: "Mov. Ciclólise",
        color: "#006400",
        size: 12
    },
    ANTIBODY: {
        type: "Anticorpo",
        color: "#4169E1",
        size: 12,
        baseSpeed: 2,
        detectionRange: 150
    },
    PATHOGEN: {
        type: "Bactéria Invasora",
        color: "#00FF00",
        size: 8,
        health: 100,
        baseSpeed: 1.5
    }
};

class Cell {
    constructor(type, x, y) {
        Object.assign(this, CELL_TYPES[type]);
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.z = Math.random() * 100; // Adiciona profundidade
        this.dx = randomSpeed() * (this.baseSpeed || 1);
        this.dy = randomSpeed() * (this.baseSpeed || 1);
        this.dz = randomSpeed() * (this.baseSpeed || 1);
        this.age = 0;
        this.pseudopods = [];
        this.contract = 1;
        this.direction = 1;
        this.target = null;
        this.fighting = false;
        this.cellType = type;
        this.energy = 100;
        this.lastReproduction = 0;
    }

    update(cells) {
        this.age += 0.1;
        this.energy -= 0.05;
        
        // Morte natural
        if (this.age > this.maxAge || this.energy <= 0 || this.health <= 0) {
            return 'die';
        }
    
        // Reprodução
        if (this.canReproduce(cells)) {
            this.lastReproduction = this.age;
            return new Cell(this.cellType, this.x + randomSpeed() * 10, this.y + randomSpeed() * 10);
        }
    
        // Movimento 3D
        this.z += this.dz;
        if (this.z < 0 || this.z > 100) this.dz *= -1;
    
        const baseUpdate = this.updateBaseMovement(cells);
        if (baseUpdate) return baseUpdate;
    
        // Interações entre células
        this.interactWithOthers(cells);
    
        return null;
    }

    canReproduce(cells) {
        const sameTypeCells = cells.filter(c => c.cellType === this.cellType).length;
        const totalCells = cells.length;
        
        // Condições para reprodução
        return Math.random() < this.reproductionRate && 
               this.age > this.lastReproduction + 100 && 
               this.energy > 70 &&
               this.health > 50 &&
               ((this.type === "Anticorpo" && sameTypeCells < 20) || 
                (this.type === "Bactéria Invasora" && sameTypeCells < 15) ||
                (sameTypeCells < 10));
    }

    updateBaseMovement(cells) {
        switch (this.type) {
            case "Mov. Ameboide":
                return this.updateAmoeba();
            case "Mov. Flagelar":
                return this.updateFlagellate();
            case "Mov. Contração":
                return this.updateMuscle();
            case "Mov. Browniano":
                return this.updateBrownian();
            case "Mov. Ciclólise":
                return this.updateCyclosis();
            case "Anticorpo":
                return this.updateAntibody(cells);
            case "Bactéria Invasora":
                return this.updatePathogen(cells);
        }
    }

    interactWithOthers(cells) {
        cells.forEach(other => {
            if (other !== this && this.distanceTo3D(other) < (this.size + other.size)) {
                // Colisão
                this.handleCollision(other);
                
                // Transferência de energia
                if (this.energy > other.energy + 20) {
                    const transfer = 10;
                    this.energy -= transfer;
                    other.energy += transfer;
                }
            }
        });
    }

    handleCollision(other) {
        // Inversão de direção após colisão
        const angle = Math.atan2(this.y - other.y, this.x - other.x);
        this.dx = Math.cos(angle) * this.baseSpeed;
        this.dy = Math.sin(angle) * this.baseSpeed;
        
        // Dano em caso de colisão entre anticorpo e patógeno
        if (this.type === "Anticorpo" && other.type === "Bactéria Invasora") {
            other.health -= 5;
            this.health -= 1;
        }
    }

    distanceTo3D(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const dz = other.z - this.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }


    updateAmoeba() {
        if (Math.random() < 0.02) {
            this.pseudopods.push({
                x: (Math.random() - 0.5) * 40,
                y: (Math.random() - 0.5) * 40,
                age: 0
            });
        }
        this.pseudopods = this.pseudopods.filter(p => p.age++ < 50);
        this.x += this.dx;
        this.y += this.dy;
    }

    updateFlagellate() {
        this.x += this.dx;
        this.y += this.dy;
        if (this.x <= 0 || this.x + 20 >= canvas.width) this.dx *= -1;
        if (this.y <= 0 || this.y + 20 >= canvas.height) this.dy *= -1;
    }

    updateMuscle() {
        this.contract = Math.sin(Date.now() / 200) * 5 + 15;
    }

    updateBrownian() {
        this.x += (Math.random() - 0.5) * 2;
        this.y += (Math.random() - 0.5) * 2;
    }

    updateCyclosis() {
        this.x += Math.cos(Date.now() / 1000) * 2 * this.direction;
        this.y += Math.sin(Date.now() / 1000) * 2 * this.direction;
        if (Math.random() < 0.01) this.direction *= -1;
    }

    updateAntibody(cells) {
        if (!this.target || this.target.health <= 0) {
            let nearestPathogen = null;
            let nearestDistance = this.detectionRange;
    
            cells.forEach(cell => {
                if (cell.type === "Bactéria Invasora" && cell.health > 0) {
                    const distance = this.distanceTo(cell);
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestPathogen = cell;
                    }
                }
            });
    
            this.target = nearestPathogen;
        }
    
        if (this.target && this.target.health > 0) {
            const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.dx = Math.cos(angle) * this.baseSpeed;
            this.dy = Math.sin(angle) * this.baseSpeed;
    
            if (this.distanceTo(this.target) < this.size + this.target.size) {
                this.fighting = true;
                this.target.health -= 1;
            } else {
                this.fighting = false;
            }
        }
    
        this.x += this.dx;
        this.y += this.dy;
    }

    updatePathogen(cells) {
        if (Math.random() < 0.02) {
            this.dx = randomSpeed() * this.baseSpeed;
            this.dy = randomSpeed() * this.baseSpeed;
        }

        this.x += this.dx;
        this.y += this.dy;

        if (Math.random() < 0.001 && cells.length < 100) {
            return new Cell('PATHOGEN', this.x + randomSpeed() * 10, this.y + randomSpeed() * 10);
        }

        return null;
    }

    distanceTo(other) {
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    draw(ctx) {
        const scale = 1 - (this.z / 200);
        const adjustedSize = this.size * scale;

        ctx.save();
        ctx.beginPath();

        const shadow = Math.floor(this.z / 2);
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = shadow;
        ctx.shadowOffsetX = shadow / 2;
        ctx.shadowOffsetY = shadow / 2;

        switch (this.type) {
            case "Mov. Ameboide":
                this.drawAmoeba(ctx);
                break;
            case "Mov. Contração":
                this.drawMuscle(ctx);
                break;
            case "Anticorpo":
                this.drawAntibody(ctx);
                break;
            case "Bactéria Invasora":
                this.drawPathogen(ctx);
                break;
            default:
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
        }

        // Draw health bar for pathogens
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, adjustedSize
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.darkenColor(this.color, 30));
        
        ctx.fillStyle = gradient;
        ctx.fill();

        // Informações vitais
        this.drawVitalSigns(ctx);

        ctx.restore();
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return `#${(1 << 24) + (R << 16) + (G << 8) + B}`;
    }

    drawVitalSigns(ctx) {
        const barWidth = 20;
        const barHeight = 2;
        const spacing = 3;
        
        // Barra de vida
        ctx.fillStyle = "#FF0000";
        ctx.fillRect(this.x - barWidth/2, this.y - this.size - 15, barWidth, barHeight);
        ctx.fillStyle = "#00FF00";
        ctx.fillRect(this.x - barWidth/2, this.y - this.size - 15, (this.health/100) * barWidth, barHeight);
        
        // Barra de energia
        ctx.fillStyle = "#666666";
        ctx.fillRect(this.x - barWidth/2, this.y - this.size - 15 - spacing, barWidth, barHeight);
        ctx.fillStyle = "#FFFF00";
        ctx.fillRect(this.x - barWidth/2, this.y - this.size - 15 - spacing, (this.energy/100) * barWidth, barHeight);
    }

    drawAmoeba(ctx) {
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        this.pseudopods.forEach(p => {
            ctx.beginPath();
            ctx.arc(this.x + p.x, this.y + p.y, 10 * (1 - p.age / 50), 0, Math.PI * 2);
            ctx.fill();
        });
    }

    drawMuscle(ctx) {
        ctx.arc(this.x, this.y, this.contract, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }

    drawAntibody(ctx) {
        ctx.strokeStyle = this.fighting ? "#FF0000" : this.color;
        ctx.lineWidth = 3;
        
        // Y-shaped antibody
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y - this.size);
        
        const armLength = this.size * 0.8;
        const angle = Math.PI / 4;
        
        ctx.lineTo(this.x - Math.cos(angle) * armLength, 
                  this.y - this.size - Math.sin(angle) * armLength);
        ctx.moveTo(this.x, this.y - this.size);
        ctx.lineTo(this.x + Math.cos(angle) * armLength,
                  this.y - this.size - Math.sin(angle) * armLength);
        
        ctx.stroke();
    }

    drawPathogen(ctx) {
        ctx.fillStyle = this.color + Math.floor((this.health / 100) * 255).toString(16);
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // Flagella
        const t = Date.now() * 0.005;
        ctx.beginPath();
        ctx.moveTo(this.x - this.size, this.y);
        for (let i = 0; i < 5; i++) {
            const wave = Math.sin(t + i * 0.5) * 3;
            ctx.lineTo(
                this.x - this.size - i * 2,
                this.y + wave
            );
        }
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function randomSpeed() {
    return (Math.random() - 0.5) * 4;
}

let cells = [];
const cellsPerType = 5;


['AMOEBA', 'FLAGELLATE', 'MUSCLE', 'BACTERIUM', 'CILIATE'].forEach(type => {
    for (let i = 0; i < cellsPerType; i++) {
        cells.push(new Cell(type));
    }
});

for (let i = 0; i < 10; i++) {
    cells.push(new Cell('ANTIBODY'));
}

function spawnPathogen() {
    const currentPathogens = cells.filter(c => c.type === "Bactéria Invasora").length;
    const currentAntibodies = cells.filter(c => c.type === "Anticorpo").length;
    
    if (cells.length < 100) {
        // Spawn de patógenos apenas se houver menos patógenos que anticorpos
        if (currentPathogens < currentAntibodies) {
            cells.push(new Cell('PATHOGEN'));
        }
        // Spawn de anticorpos se necessário
        if (currentAntibodies < 5) {
            cells.push(new Cell('ANTIBODY'));
        }
    }
    setTimeout(spawnPathogen, Math.random() * 2000 + 1000);
}

function update() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const newCells = [];
    cells = cells.filter(cell => cell.type !== "Bactéria Invasora" || cell.health > 0);
    
    cells.forEach(cell => {
        console.log(`Cell Type: ${cell.type}, Health: ${cell.health}, Energy: ${cell.energy}`);
        if (cell instanceof Cell) {
            const offspring = cell.update(cells);
            if (offspring) {
                newCells.push(offspring);
            }
            cell.draw(ctx);
        }
    });

    cells = cells.concat(newCells);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "16px Arial";
    ctx.fillText(`Bactérias Invasoras: ${cells.filter(c => c.type === "Bactéria Invasora").length}`, 10, 30);
    ctx.fillText(`Anticorpos: ${cells.filter(c => c.type === "Anticorpo").length}`, 10, 50);

    requestAnimationFrame(update);
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight - 40;
});

spawnPathogen();
update();