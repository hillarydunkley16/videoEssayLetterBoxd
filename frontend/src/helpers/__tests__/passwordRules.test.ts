import { PASSWORD_RULES, passwordMeetsRules } from '../passwordRules';

describe('password rules', () => {
  it('lists a number rule and a special character rule', () => {
    expect(PASSWORD_RULES.map((r) => r.label)).toEqual(['Includes a number', 'Includes a special character']);
  });

  it.each([
    ['hunter2!', true],
    ['correct horse 9 #', true],
    ['hunter22', false], // no special character
    ['hunter!!!', false], // no number
    ['12345678', false],
    ['!!!!!!!!', false],
    ['', false],
  ])('%j meets the rules: %s', (password, expected) => {
    expect(passwordMeetsRules(password)).toBe(expected);
  });

  it('reports which rule each password meets', () => {
    const results = (pw: string) => PASSWORD_RULES.map((r) => r.test(pw));
    expect(results('abc1')).toEqual([true, false]);
    expect(results('abc!')).toEqual([false, true]);
  });

  it('does not count letters with accents or spaces as special characters', () => {
    expect(passwordMeetsRules('héllo wörld 1')).toBe(false);
  });
});
