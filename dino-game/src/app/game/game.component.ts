import { Component, OnInit, OnDestroy } from '@angular/core';
import { environment } from 'src/environments/environment.prod';
import data from 'src/assets/obstacles.json';

@Component({
  selector: 'app-game',
  standalone: true,
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css'],
})
export class GameComponent implements OnInit, OnDestroy {
  private ctx: CanvasRenderingContext2D | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isRunning = true;
  private dinosaurY!: number;
  private dinosaurWidth!: number;
  private dinosaurHeight!: number;
  private isJumping = false;
  private jumpSpeed = 850;
  private gravity = 650;
  private jumpLimit!: number;
  private isFalling = false;
  private isAtTop = false;
  private obstacles: { x: number, width: number, height: number, type: string, image: HTMLImageElement }[] = [];
  private obstacleSpeed = 300;
  private gameOver = false;
  private score = 0;
  public playerName: string = '';
  public bestScore: number = 0;
  private lenNormal = 12;
  private lenHigh = 6;

  private dinosaurImage: HTMLImageElement = new Image();
  private highImages: HTMLImageElement[] = [];
  private normalImages: HTMLImageElement[] = [];
  private skyImage = new Image();
  private surfaceImage = new Image();
  private surfaceOffset = 0;
  private lastTimestamp = 0;
  private surfaceSpeed = 300;
  private myData = data;

  public myRealName: string = '';
  public leaderRealName: string = '';
  public leaderScore: number = 0;
  public leaderQuote: string = '';

  constructor() {
    console.log('Json: ', this.myData.normal, this.myData.high);
  }

  ngOnInit(): void {
    this.skyImage.src = 'assets/sky.png';
    this.surfaceImage.src = 'assets/stars.png';
    this.normalImages = this.buildImageList(this.myData.normal);
    this.highImages = this.buildImageList(this.myData.high);

    this.dinosaurImage.src = 'assets/dino.png';
    this.dinosaurImage.onload = () => this.startGame();

    this.playerName = prompt('Введите вашу почту без @ghalam.kz', 'Игрок') || 'Игрок';
    this.getBestScore();

    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.ctx = this.canvas.getContext('2d');
    }

    this.dinosaurWidth = this.canvas.width * 0.08;
    this.dinosaurHeight = this.canvas.height * 0.1;
    this.dinosaurY = this.canvas.height * 0.7;
    this.jumpLimit = this.canvas.height * 0.25;

    window.addEventListener('keydown', (event) => this.handleKeyDown(event));
    // this.spawnRandomObstacles();

    setInterval(() => {
      if (!this.gameOver) {
        this.accelerateObstacles();
      }
    }, 2000);
  }

  ngOnDestroy(): void {
    this.isRunning = false;
    window.removeEventListener('keydown', (event) => this.handleKeyDown(event));
  }

  private buildImageList(names: string[]): HTMLImageElement[] {
    return names.map((name) => {
      const img = new Image();
      img.src = `${name}`;
      return img;
    });
  }

  private getBestScore(): void {
    fetch(`${environment.apiUrl}${this.playerName}`)
      .then(res => res.json())
      .then(data => {
        this.bestScore = data.bestScore || 0;
        this.myRealName = data.realName || '';
        const leader = data.leader;
        if (leader) {
          this.leaderRealName = leader.realName;
          this.leaderScore = leader.score;
          this.leaderQuote = leader.quote;
        }
      })
      .catch(err => console.error('Ошибка при получении лучшего счета:', err));
  }

  private startGame(): void {
    if (this.ctx && this.canvas && this.dinosaurImage.complete) {
      requestAnimationFrame((ts) => {
        this.lastTimestamp = ts;
        this.updateGame(ts);
        this.spawnRandomObstacles(); // ✅ теперь тут
      });
    } else {
      console.error('Ошибка: Канвас или изображение не загружены');
    }
  }

  private updateGame(timestamp: number): void {
    if (!this.isRunning || !this.canvas || !this.ctx || this.gameOver) return;

    const dt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.surfaceOffset = (this.surfaceOffset - this.surfaceSpeed * dt) % this.canvas.width;
    this.ctx.drawImage(this.skyImage, this.canvas.width * 0.25, -this.canvas.height * 0.25, this.canvas.width * 0.5, this.canvas.height);
    this.ctx.drawImage(this.surfaceImage, this.surfaceOffset, this.canvas.height - this.surfaceImage.height, this.canvas.width, this.surfaceImage.height);
    this.ctx.drawImage(this.surfaceImage, this.surfaceOffset + this.canvas.width, this.canvas.height - this.surfaceImage.height, this.canvas.width, this.surfaceImage.height);

    this.drawDinosaur();
    this.moveObstacles(dt);

    if (this.isJumping && !this.isAtTop) {
      this.dinosaurY -= this.jumpSpeed * dt;
      if (this.dinosaurY <= this.jumpLimit) {
        this.isJumping = false;
        this.isAtTop = true;
        setTimeout(() => {
          this.isFalling = true;
          this.isAtTop = false;
        }, 120);
      }
    } else if (this.isFalling) {
      if (this.dinosaurY < this.canvas.height * 0.7) {
        this.dinosaurY += this.gravity * dt;
      } else {
        this.dinosaurY = this.canvas.height * 0.7;
        this.isFalling = false;
      }
    }

    this.checkCollision();
    this.drawScore();

    requestAnimationFrame((ts) => this.updateGame(ts));
  }

  private drawDinosaur(): void {
    if (this.ctx && this.dinosaurImage.complete && this.canvas) {
      this.ctx.drawImage(this.dinosaurImage, this.canvas.width * 0.05, this.dinosaurY, this.dinosaurWidth, this.dinosaurHeight);
    }
  }

  private createObstacle(): void {
    if (!this.canvas) return;
    const height = this.canvas.height * 0.1;
    const isHigh = Math.random() < 0.2;
    const idxNormal = Math.floor(Math.random() * this.lenNormal);
    const idxHigh = Math.floor(Math.random() * this.lenHigh);

    const obstacle = {
      x: this.canvas.width,
      width: this.canvas.width * 0.05,
      height,
      y: isHigh ? this.canvas.height * 0.7 - this.dinosaurHeight * 1.5 : this.canvas.height * 0.7,
      type: isHigh ? 'high' : 'normal',
      image: isHigh ? this.highImages[idxHigh] : this.normalImages[idxNormal],
    };
    this.obstacles.push(obstacle);
  }

  private moveObstacles(dt: number): void {
    for (let i = 0; i < this.obstacles.length; i++) {
      const obstacle = this.obstacles[i];
      obstacle.x -= this.obstacleSpeed * dt;

      if (obstacle.x + obstacle.width < 0) {
        this.obstacles.splice(i, 1);
        i--;
        this.score++;
        this.checkForBestScore();
      }

      if (this.ctx && obstacle.image.complete && this.canvas) {
        const y = obstacle.type === 'high' ? this.canvas.height * 0.7 - this.dinosaurHeight * 1.5 : this.canvas.height * 0.7;
        this.ctx.drawImage(obstacle.image, obstacle.x, y, obstacle.width, obstacle.height);
      }
    }
  }

  private checkForBestScore(): void {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
    }
  }

  private checkCollision(): void {
    if (!this.canvas) return;
    for (const obstacle of this.obstacles) {
      const dinoRight = this.canvas.width * 0.05 + this.dinosaurWidth;
      const dinoLeft = this.canvas.width * 0.05;
      const obsRight = obstacle.x + obstacle.width;
      const obsLeft = obstacle.x;

      if (dinoRight > obsLeft && dinoLeft < obsRight) {
        if (
          (obstacle.type === 'normal' && this.dinosaurY + this.dinosaurHeight > this.canvas.height * 0.7) ||
          (obstacle.type === 'high' && this.dinosaurY <= this.canvas.height * 0.7 - obstacle.height)
        ) {
          this.gameOver = true;
          if (this.myRealName === 'ghalam_gamer') {
            alert('Game Over, Ghalam Gamer!');
          } else {
            this.updateBestScore();
          }
        }
      }
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.canvas && event.code === 'Space' && !this.isJumping && this.dinosaurY === this.canvas.height * 0.7) {
      this.isJumping = true;
    }
  }

  private spawnRandomObstacles(): void {
    const randomSpawn = () => {
      if (!this.gameOver && this.canvas) {
        this.createObstacle();
  
        const width = this.canvas.width;

        const speedFactor = Math.max(1, this.obstacleSpeed);
  
        // Базовые значения интервалов в зависимости от ширины
        const minInterval = width * 0.9 + speedFactor * 0.25;
        const maxInterval = width * 1.1 + speedFactor * 0.25;
  
        // Сложность — экспоненциальный коэффициент уменьшения интервалов с ростом очков
        const difficulty = Math.exp(-this.score / 50);  // более мягкое уменьшение
  
        // Случайный коэффициент — увеличивает вариативность
        const randomFactor = 0.6 + Math.random() * 0.9; // от 0.6 до 1.5
  
        const interval = Math.max(minInterval, maxInterval * difficulty) * randomFactor;
  
        setTimeout(randomSpawn, interval);
      }
    };
  
    // ⏱ Первая задержка, чтобы препятствия не появлялись до начала игры
    setTimeout(randomSpawn, 1500);
  }
  

  private accelerateObstacles(): void {
    if (this.obstacleSpeed < 10000) {
      this.obstacleSpeed += 25;
    }
  }

  private updateBestScore(): void {
    if (this.gameOver && this.score <= this.leaderScore) {
      alert('Game Over!');
    }
    if (this.score >= this.bestScore) {
      if (this.score > this.leaderScore && this.gameOver) {
        const quote = prompt('Game Over! Вы новый лидер! Введите вашу цитату (до 100 символов):', '') || '';
        this.leaderQuote = quote.slice(0, 100);
      }
      fetch(`${environment.apiUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: this.playerName,
          realName: this.myRealName,
          quote: this.leaderQuote,
          score: this.score,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          this.bestScore = data.bestScore;
        })
        .catch((error) => console.error('Error updating best score:', error));
    }
  }

  private drawScore(): void {
    if (this.ctx) {
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 40px Arial';
      this.ctx.fillText(`Score: ${this.score}`, 10, 30);
      this.ctx.fillText(`Best Score: ${this.bestScore}`, 10, 60);
    }
  }
}
