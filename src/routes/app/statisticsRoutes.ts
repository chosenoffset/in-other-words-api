import { Router, Request, Response } from "express";
import { User } from "@prisma/client";
import { ApiError } from "../../utils/error.js";
import {
  getPlayerStats,
  recalculatePlayerStats,
  getRecentGameSessions
} from "../../services/statisticsService.js";

const router = Router();

/**
 * GET /api/app/stats/player
 * Get current user's statistics
 */
router.get('/player', async (req: Request, res: Response) => {
    const stats = await getPlayerStats(res.locals.user as User);

    res.json({
      success: true,
      data: stats
    });
});

/**
 * POST /api/app/stats/recalculate
 * Force recalculation of current user's statistics (useful for development/debugging)
 */
router.post('/recalculate', async (req: Request, res: Response) => {
 const stats = await recalculatePlayerStats(res.locals.user as User);

    res.json({
      success: true,
      message: 'Statistics recalculated successfully',
      data: stats
    });
});

/**
 * GET /api/app/stats/sessions
 * Get recent game sessions for current user (debugging/analysis endpoint)
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const user = res.locals.user as User;

    if (!user?.id) {
      throw new ApiError(401, 'User not authenticated');
    }

    const limit = parseInt(req.query.limit as string) || 10;

    if (limit > 50) {
      throw new ApiError(400, 'Limit cannot exceed 50');
    }

    const sessions = await getRecentGameSessions(user.id, limit);

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to retrieve game sessions');
  }
});

export default router;