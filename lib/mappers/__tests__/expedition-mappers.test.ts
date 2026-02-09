import { describe, it, expect } from 'vitest';
import { toSandboxOrderDTO, toDeliveryRouteDTO, toOrderItemDTO } from '../expedition-mappers';

describe('expedition-mappers', () => {
    describe('toOrderItemDTO', () => {
        it('should convert order item to serializable DTO', () => {
            const mockItem = {
                id: 'item-123',
                quantity: 10,
                unit_price: 50.5,
                unit_weight_kg: 2.5,
                balance: 8,
                delivered: 2,
                packaging: {
                    id: 'pkg-1',
                    label: 'Caixa 12un',
                    qty_in_base: 12
                },
                product: {
                    id: 'prod-1',
                    name: 'Produto Teste',
                    sku: 'SKU-001',
                    net_weight_g_base: 250
                }
            };

            const dto = toOrderItemDTO(mockItem);

            // Should be serializable
            expect(() => JSON.stringify(dto)).not.toThrow();

            // Should have all required fields
            expect(dto.id).toBe('item-123');
            expect(dto.quantity).toBe(10);
            expect(dto.balance).toBe(8);
            expect(dto.delivered).toBe(2);
            expect(dto.packaging).toBeDefined();
            expect(dto.product).toBeDefined();
        });

        it('should handle null packaging and product', () => {
            const mockItem = {
                id: 'item-123',
                quantity: 10,
                unit_price: 50.5,
                unit_weight_kg: 2.5,
                packaging: null,
                product: null
            };

            const dto = toOrderItemDTO(mockItem);

            expect(dto.packaging).toBeNull();
            expect(dto.product).toBeNull();
            expect(() => JSON.stringify(dto)).not.toThrow();
        });
    });

    describe('toSandboxOrderDTO', () => {
        it('should convert order to serializable DTO', () => {
            const mockOrder = {
                id: 'order-123',
                document_number: 'PV-001',
                total_amount: 1000,
                date_issued: '2026-02-06',
                status_commercial: 'confirmed',
                status_logistic: 'pending',
                total_weight_kg: 50,
                original_weight: 60,
                original_amount: 1200,
                is_partial_balance: true,
                client: {
                    trade_name: 'Cliente Teste Ltda'
                },
                items: [
                    {
                        id: 'item-1',
                        quantity: 5,
                        unit_price: 200,
                        unit_weight_kg: 10,
                        balance: 5,
                        delivered: 0,
                        packaging: null,
                        product: null
                    }
                ]
            };

            const dto = toSandboxOrderDTO(mockOrder);

            // Should be serializable
            expect(() => JSON.stringify(dto)).not.toThrow();

            // Date should be string (not Date object)
            expect(typeof dto.date_issued).toBe('string');
            expect(dto.date_issued).toBe('2026-02-06');

            // Should have all required fields
            expect(dto.id).toBe('order-123');
            expect(dto.document_number).toBe('PV-001');
            expect(dto.total_amount).toBe(1000);
            expect(dto.is_partial_balance).toBe(true);
            expect(dto.client?.trade_name).toBe('Cliente Teste Ltda');
            expect(dto.items).toHaveLength(1);
        });

        it('should handle null client', () => {
            const mockOrder = {
                id: 'order-123',
                document_number: 'PV-001',
                total_amount: 1000,
                date_issued: '2026-02-06',
                status_commercial: 'confirmed',
                status_logistic: 'pending',
                total_weight_kg: 50,
                client: null,
                items: []
            };

            const dto = toSandboxOrderDTO(mockOrder);

            expect(dto.client).toBeNull();
            expect(() => JSON.stringify(dto)).not.toThrow();
        });
    });

    describe('toDeliveryRouteDTO', () => {
        it('should convert route to serializable DTO', () => {
            const mockRoute = {
                id: 'route-123',
                name: 'Rota Teste',
                route_date: '2026-02-06',
                scheduled_date: '2026-02-07',
                status: 'planned',
                company_id: 'company-1',
                created_at: '2026-02-06T10:00:00Z',
                orders: [
                    {
                        id: 'ro-1',
                        position: 1,
                        volumes: 3,
                        loading_status: 'pending',
                        partial_payload: null,
                        sales_document_id: 'order-1',
                        sales_order: {
                            id: 'order-1',
                            document_number: 'PV-001',
                            total_amount: 500,
                            date_issued: '2026-02-05',
                            status_commercial: 'confirmed',
                            status_logistic: 'routed',
                            total_weight_kg: 25,
                            is_partial_balance: false,
                            client: { trade_name: 'Cliente A' },
                            items: []
                        }
                    }
                ]
            };

            const dto = toDeliveryRouteDTO(mockRoute);

            // Should be serializable
            expect(() => JSON.stringify(dto)).not.toThrow();

            // Dates should be strings
            expect(typeof dto.route_date).toBe('string');
            expect(typeof dto.scheduled_date).toBe('string');
            expect(typeof dto.created_at).toBe('string');

            // Should have all required fields
            expect(dto.id).toBe('route-123');
            expect(dto.name).toBe('Rota Teste');
            expect(dto.status).toBe('planned');
            expect(dto.orders).toHaveLength(1);
            expect(dto.orders[0].sales_order).toBeDefined();
        });

        it('should handle null scheduled_date', () => {
            const mockRoute = {
                id: 'route-123',
                name: 'Rota Não Agendada',
                route_date: '2026-02-06',
                scheduled_date: null,
                status: 'pending',
                company_id: 'company-1',
                created_at: '2026-02-06T10:00:00Z',
                orders: []
            };

            const dto = toDeliveryRouteDTO(mockRoute);

            expect(dto.scheduled_date).toBeNull();
            expect(() => JSON.stringify(dto)).not.toThrow();
        });
    });

    describe('serialization guarantee', () => {
        it('should produce DTOs without Date objects', () => {
            const mockOrder = {
                id: 'order-1',
                document_number: 'PV-001',
                total_amount: 1000,
                date_issued: '2026-02-06',
                status_commercial: 'confirmed',
                status_logistic: 'pending',
                total_weight_kg: 50,
                client: null,
                items: []
            };

            const dto = toSandboxOrderDTO(mockOrder);
            const serialized = JSON.stringify(dto);
            const deserialized = JSON.parse(serialized);

            // After round-trip, dates should still be strings
            expect(typeof deserialized.date_issued).toBe('string');
            expect(deserialized.date_issued).toBe('2026-02-06');
        });
    });
});
