export const RoomMode = {
  STANDARD: "STANDARD",
  STANDBY: "STANDBY",
  PERSONAL: "PERSONAL",
  STORE_ROOM: "STORE_ROOM",
} as const;
export type RoomMode = (typeof RoomMode)[keyof typeof RoomMode];

export const RoomStatus = {
  AVAILABLE: "AVAILABLE",
  OCCUPIED: "OCCUPIED",
  NEEDS_CLEANING: "NEEDS_CLEANING",
  MAINTENANCE: "MAINTENANCE",
} as const;
export type RoomStatus = (typeof RoomStatus)[keyof typeof RoomStatus];

export const CoolingType = {
  AC: "AC",
  FAN_COOLER: "FAN_COOLER",
  FAN_ONLY: "FAN_ONLY",
} as const;
export type CoolingType = (typeof CoolingType)[keyof typeof CoolingType];

export const BedType = {
  NORMAL: "NORMAL",
  BETTER_BED: "BETTER_BED",
  SINGLE_BED: "SINGLE_BED",
  DOUBLE_BED: "DOUBLE_BED",
} as const;
export type BedType = (typeof BedType)[keyof typeof BedType];

export const StayType = {
  DAILY: "DAILY",
  MONTHLY: "MONTHLY",
} as const;
export type StayType = (typeof StayType)[keyof typeof StayType];

export const PaymentType = {
  ADVANCE: "ADVANCE",
  MID_STAY: "MID_STAY",
  CHECKOUT_SETTLEMENT: "CHECKOUT_SETTLEMENT",
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];
