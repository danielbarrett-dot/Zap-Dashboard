import { Prisma } from "@prisma/client";

export const toCurrencyNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return 0;
  }

  return typeof value === "number" ? value : value.toNumber();
};

export const safeDivide = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : 0;

export const roundCurrency = (value: number) => Number(value.toFixed(2));

