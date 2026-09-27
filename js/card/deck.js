/**
 * Deck — 牌堆管理。
 * 维护抽牌堆 / 弃牌堆 / 消耗堆 / 手牌四区。
 * draw 时抽牌堆空则自动洗弃牌堆,模拟桌游物理牌堆。
 */

export class Deck {
  constructor(cards, rng) {
    this.rng = rng;
    this.drawPile = cards.slice();
    this.discardPile = [];
    this.exhaustPile = [];
    this.hand = [];
    this.shuffle();
  }

  /** 洗抽牌堆 */
  shuffle() {
    this.rng.shuffle(this.drawPile);
    return this;
  }

  /** 从抽牌堆抽 n 张到手牌,不够则先回收弃牌堆 */
  draw(n = 1) {
    const drawn = [];
    for (let i = 0; i < n; i++) {
      if (this.drawPile.length === 0) {
        if (this.discardPile.length === 0) break;
        this.drawPile = this.discardPile.splice(0);
        this.shuffle();
      }
      const card = this.drawPile.pop();
      if (card) drawn.push(card);
    }
    this.hand.push(...drawn);
    return drawn;
  }

  /** 弃单张 */
  discard(card) {
    const i = this.hand.indexOf(card);
    if (i >= 0) this.hand.splice(i, 1);
    if (card) this.discardPile.push(card);
  }

  /** 消耗单张(不进弃牌堆) */
  exhaust(card) {
    const i = this.hand.indexOf(card);
    if (i >= 0) this.hand.splice(i, 1);
    if (card) this.exhaustPile.push(card);
  }

  /** 弃整手 */
  discardHand() {
    this.discardPile.push(...this.hand);
    this.hand = [];
  }

  /** 战斗重置:所有牌回抽牌堆并洗牌 */
  reset() {
    this.drawPile = [
      ...this.drawPile,
      ...this.discardPile,
      ...this.exhaustPile,
      ...this.hand,
    ];
    this.discardPile = [];
    this.exhaustPile = [];
    this.hand = [];
    this.shuffle();
  }

  /** 非战斗时新增一张到牌组(如奖励选牌) */
  addToMaster(card) {
    this.drawPile.push(card);
  }
}
