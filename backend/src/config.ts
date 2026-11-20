// Free play vs real money. ELO launches in FREE PLAY: credits are free, have no cash value, can't be
// deposited or withdrawn. Real money stays OFF unless REAL_MONEY=true is set explicitly (and should only be
// set after legal review for the countries served).
export const REAL_MONEY = process.env.REAL_MONEY === 'true';
export const FREE_PLAY_MESSAGE = 'ELO is free to play: credits have no cash value and cannot be deposited or withdrawn.';
