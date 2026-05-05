"use client";

import { useState } from "react";

type Exercise = "oop" | "functional" | "errors" | "currency";

const EXERCISES: { id: Exercise; label: string; description: string }[] = [
  {
    id: "oop",
    label: "OOP Basics",
    description: "Classes, inheritance, and the four pillars",
  },
  {
    id: "functional",
    label: "Functional",
    description: "Map, filter, reduce, and lambda",
  },
  {
    id: "errors",
    label: "Error Handling",
    description: "Try/except and custom exceptions",
  },
  {
    id: "currency",
    label: "Currency Exchange",
    description: "Emulator with rates and conversion",
  },
];

const CODE_SAMPLES: Record<Exercise, { python: string; typescript: string }> = {
  oop: {
    python: `class Animal:
    def __init__(self, name, species):
        self.name = name
        self.species = species

    def speak(self):
        return f"{self.name} makes a sound"

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name, "Canine")
        self.breed = breed

    def speak(self):
        return f"{self.name} says Woof!"

buddy = Dog("Buddy", "Golden Retriever")
print(buddy.speak())  # Buddy says Woof!`,
    typescript: `class Animal {
  constructor(
    public name: string,
    public species: string
  ) {}

  speak(): string {
    return \`\${this.name} makes a sound\`;
  }
}

class Dog extends Animal {
  constructor(name: string, public breed: string) {
    super(name, "Canine");
  }

  speak(): string {
    return \`\${this.name} says Woof!\`;
  }
}

const buddy = new Dog("Buddy", "Golden Retriever");
console.log(buddy.speak()); // Buddy says Woof!`,
  },
  functional: {
    python: `numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# Filter even numbers
evens = list(filter(lambda x: x % 2 == 0, numbers))

# Square them
squared = list(map(lambda x: x ** 2, evens))

# Sum the result
from functools import reduce
total = reduce(lambda a, b: a + b, squared)

print(f"Evens: {evens}")      # [2, 4, 6, 8, 10]
print(f"Squared: {squared}")  # [4, 16, 36, 64, 100]
print(f"Sum: {total}")        # 220`,
    typescript: `const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const evens = numbers.filter(x => x % 2 === 0);
const squared = evens.map(x => x ** 2);
const total = squared.reduce((a, b) => a + b, 0);

console.log("Evens:", evens);      // [2, 4, 6, 8, 10]
console.log("Squared:", squared);  // [4, 16, 36, 64, 100]
console.log("Sum:", total);        // 220`,
  },
  errors: {
    python: `class InsufficientFundsError(Exception):
    def __init__(self, balance, amount):
        self.balance = balance
        self.amount = amount
        super().__init__(
            f"Cannot withdraw $\{amount}. "
            f"Balance: $\{balance}"
        )

def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFundsError(balance, amount)
    return balance - amount

try:
    new_balance = withdraw(100, 150)
except InsufficientFundsError as e:
    print(e)  # Cannot withdraw $150. Balance: $100
except Exception as e:
    print(f"Unexpected error: {e}")
finally:
    print("Transaction complete")`,
    typescript: `class InsufficientFundsError extends Error {
  constructor(
    public balance: number,
    public amount: number
  ) {
    super(
      \`Cannot withdraw $\${amount}. \` +
      \`Balance: $\${balance}\`
    );
  }
}

function withdraw(balance: number, amount: number) {
  if (amount > balance) {
    throw new InsufficientFundsError(balance, amount);
  }
  return balance - amount;
}

try {
  const newBalance = withdraw(100, 150);
} catch (e) {
  if (e instanceof InsufficientFundsError) {
    console.log(e.message);
  }
} finally {
  console.log("Transaction complete");
}`,
  },
  currency: {
    python: `RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "GBP": 0.79,
    "JPY": 149.50,
    "CAD": 1.36,
}

def convert(amount, from_curr, to_curr):
    if from_curr not in RATES or to_curr not in RATES:
        raise ValueError(f"Unknown currency")
    usd = amount / RATES[from_curr]
    return round(usd * RATES[to_curr], 2)

result = convert(100, "USD", "EUR")
print(f"$100 USD = €{result} EUR")  # €92.0

result = convert(1000, "JPY", "GBP")
print(f"¥1000 JPY = £{result} GBP")`,
    typescript: `const RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CAD: 1.36,
};

function convert(
  amount: number,
  from: string,
  to: string
): number {
  const fromRate = RATES[from];
  const toRate = RATES[to];
  if (!fromRate || !toRate) {
    throw new Error("Unknown currency");
  }
  const usd = amount / fromRate;
  return Math.round(usd * toRate * 100) / 100;
}

console.log(convert(100, "USD", "EUR"));  // 92
console.log(convert(1000, "JPY", "GBP"));`,
  },
};

export function PythonFundamentals() {
  const [exercise, setExercise] = useState<Exercise>("oop");
  const [showTs, setShowTs] = useState(false);

  const code = CODE_SAMPLES[exercise];

  return (
    <div className="flex min-h-[60vh] flex-col p-6">
      <h2 className="mb-4 text-2xl font-bold">Python Fundamentals</h2>

      <div className="mb-4 flex flex-wrap gap-1">
        {EXERCISES.map((ex) => (
          <button
            key={ex.id}
            onClick={() => setExercise(ex.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${exercise === ex.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
          >
            {ex.label}
          </button>
        ))}
      </div>

      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        {EXERCISES.find((e) => e.id === exercise)?.description}
      </p>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-medium">Python</span>
        <button
          onClick={() => setShowTs(!showTs)}
          className={`relative h-6 w-11 rounded-full transition-colors ${showTs ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${showTs ? "translate-x-5" : ""}`}
          />
        </button>
        <span className="text-sm font-medium">TypeScript</span>
      </div>

      <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
        <code>{showTs ? code.typescript : code.python}</code>
      </pre>
    </div>
  );
}
