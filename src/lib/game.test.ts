import { describe,expect,it } from "vitest";
import { calculateEffectiveSeconds,calculateSessionXp,getLevel } from "./game";
describe("cronômetro persistente",()=>{
  it("calcula a duração a partir de timestamps e desconta pausas",()=>expect(calculateEffectiveSeconds("2026-08-04T20:00:00Z","2026-08-04T21:00:00Z",600)).toBe(3000));
  it("congela no instante da pausa",()=>expect(calculateEffectiveSeconds("2026-08-04T20:00:00Z","2026-08-04T22:00:00Z",0,"2026-08-04T20:15:00Z")).toBe(900));
  it("nunca retorna duração negativa",()=>expect(calculateEffectiveSeconds("2026-08-04T21:00:00Z","2026-08-04T20:00:00Z",0)).toBe(0));
});
describe("XP",()=>{
  it("concede 10 XP no check-in sem um minuto válido",()=>expect(calculateSessionXp(30,45)).toBe(10));
  it("soma check-in, checkout, blocos de tempo e meta",()=>expect(calculateSessionXp(45*60,45)).toBe(70));
  it("não concede bônus de meta incompleta",()=>expect(calculateSessionXp(20*60,45)).toBe(40));
});
describe("níveis",()=>{it("resolve nível e progresso",()=>{const level=getLevel(1485);expect(level.name).toBe("Focado");expect(level.progress).toBe(25)});it("limita o nível máximo",()=>expect(getLevel(99999).level).toBe(7));});
