/**
 * Expedition Component Types
 * 
 * Minimal types for UI components to avoid coupling to large DTOs.
 * Each type contains only what the component actually uses.
 */

/**
 * Minimal order info for calendar display
 */
export type OrderForCalendar = {
    sales_order: {
        total_weight_kg: number;
    } | null;
};

/**
 * Minimal route info for calendar display
 */
export type RouteForCalendar = {
    id: string;
    name: string;
    scheduled_date: string | null;
    orders: OrderForCalendar[];
};

/**
 * Minimal order info for route cards
 */
export type OrderForCard = {
    id: string;
    volumes: number | null;
    loading_status: string;
    sales_order: {
        id: string;
        document_number: string;
        total_amount: number;
        total_weight_kg: number;
        client: { trade_name: string } | null;
        items?: any[];  // For OrderItemsPopover
    } | null;
    partial_payload?: any;
};

/**
 * Minimal route info for route cards
 */
export type RouteForCard = {
    id: string;
    name: string;
    scheduled_date: string | null;
    status: string;
    orders: OrderForCard[];
};

/**
 * Minimal route info for modals
 */
export type RouteForModal = {
    id: string;
    name: string;
    orders: Array<{
        sales_order: {
            total_amount: number;
        } | null;
    }>;
};

import { DeliveryRouteDTO } from "@/lib/types/sales-dto";

/**
 * Minimal route info for history table
 */
export type RouteForHistoryTable = DeliveryRouteDTO;
