import { NextRequest, NextResponse } from "next/server";

type RoleType = 'Student' | 'Professional' | 'Entrepreneur';

interface Task {
  id?: string;
  userId?: string;
  title: string;
  dueDate: string;
  category: string;
  status: 'pending' | 'completed';
}

const EFFORT_MAPPING: Record<RoleType, Record<string, number>> = {
  Student: {
    Education: 4,
    Writing: 6,
    Personal: 1,
    Health: 1,
  },
  Professional: {
    Work: 5,
    Finance: 3,
    Strategy: 6,
    Personal: 1.5,
    Health: 1,
  },
  Entrepreneur: {
    Strategy: 8,
    "Investor Relations": 5,
    Work: 4,
    Finance: 4,
    Personal: 2,
    Health: 1,
  },
};

export async function POST(req: NextRequest) {
  try {
    const { tasks, role } = await req.json() as { tasks: Task[]; role: RoleType };
    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: "Invalid tasks" }, { status: 400 });
    }

    const now = new Date().getTime();
    const scores: Record<string, number> = {};

    tasks.forEach((task) => {
      if (!task.id) return;
      if (task.status === 'completed') {
        scores[task.id] = 1; // Completed tasks have the lowest nag index
        return;
      }

      // Calculate remaining time in hours
      const dueTime = new Date(task.dueDate).getTime();
      const remainingHours = (dueTime - now) / (1000 * 60 * 60);

      // Get estimated effort for category
      const roleEffortMap = EFFORT_MAPPING[role] || EFFORT_MAPPING['Student'];
      const effort = roleEffortMap[task.category] || 3; // default effort is 3 hours

      let score = 1;

      if (remainingHours <= 0) {
        // Overdue tasks are extremely critical
        score = 10;
      } else {
        // Base scoring logic based on remaining hours versus effort
        // High effort + short remaining time = higher score
        const ratio = effort / remainingHours;
        
        if (remainingHours < 2) {
          score = 10;
        } else if (remainingHours < 4) {
          score = 9;
        } else if (remainingHours < 6) {
          score = ratio > 1 ? 8 : 7;
        } else if (remainingHours < 12) {
          score = ratio > 0.5 ? 6 : 5;
        } else if (remainingHours < 24) {
          score = ratio > 0.2 ? 4 : 3;
        } else {
          score = ratio > 0.1 ? 2 : 1;
        }
      }

      scores[task.id] = score;
    });

    return NextResponse.json({ scores });
  } catch (error: any) {
    console.log("[Info] Nag Index calculation error:", error?.message || error);
    return NextResponse.json({ error: "Failed to calculate Nag Index" }, { status: 500 });
  }
}
