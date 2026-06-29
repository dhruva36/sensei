export type SplitType = "equal" | "amount" | "share";

export type Member = {
  id: string;
  trip_id: string;
  name: string;
  created_at: string;
};

export type Trip = {
  id: string;
  name: string;
  join_code: string;
  currency: string;
  created_at: string;
};

export type TransactionSplit = {
  id: string;
  transaction_id: string;
  member_id: string;
  weight: number;
};

export type Transaction = {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  paid_by: string;
  split_type: SplitType;
  created_at: string;
  splits: TransactionSplit[];
};

/** A recorded real-world payment: `from_member` paid `to_member` `amount`. */
export type Settlement = {
  id: string;
  trip_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  note: string | null;
  created_at: string;
};

/** A single transfer in the final settlement: `from` pays `to` `amount`. */
export type Transfer = {
  from: string; // member id
  to: string; // member id
  amount: number;
};

/** Net balance for a member: positive = others owe them; negative = they owe. */
export type Balance = {
  memberId: string;
  amount: number;
};
