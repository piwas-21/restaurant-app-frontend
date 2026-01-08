using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RestaurantSystem.Api.Common;
using RestaurantSystem.Api.Common.Models;
using RestaurantSystem.Api.Features.Reservations.Commands.CancelReservationCommand;
using RestaurantSystem.Api.Features.Reservations.Commands.ConfirmReservationCommand;
using RestaurantSystem.Api.Features.Reservations.Commands.CreateReservationCommand;
using RestaurantSystem.Api.Features.Reservations.Commands.DeleteReservationCommand;
using RestaurantSystem.Api.Features.Reservations.Commands.UpdateReservationCommand;
using RestaurantSystem.Api.Features.Reservations.Dtos;
using RestaurantSystem.Api.Features.Reservations.Queries.GetAvailableTimeSlotsQuery;
using RestaurantSystem.Api.Features.Reservations.Queries.GetReservationsQuery;
using RestaurantSystem.Domain.Common.Enums;
using System.Security.Claims;

namespace RestaurantSystem.Api.Features.Reservations;

[ApiController]
[Route("api/[controller]")]
public class ReservationsController : ControllerBase
{
    private readonly CustomMediator _mediator;
    private readonly ILogger<ReservationsController> _logger;

    public ReservationsController(CustomMediator mediator, ILogger<ReservationsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Get all reservations (Admin only, or customer's own reservations)
    /// </summary>
    [HttpGet]
    [Authorize]
    public async Task<ActionResult<ApiResponse<PagedResult<ReservationDto>>>> GetReservations(
        [FromQuery] DateTime? date = null,
        [FromQuery] Guid? tableId = null,
        [FromQuery] ReservationStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value;

        Guid? customerId = null;

        // Non-admin users can only see their own reservations
        if (userRole != "Admin")
        {
            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(ApiResponse<PagedResult<ReservationDto>>.Failure("Invalid user ID"));
            }
            customerId = userId;
        }

        var query = new GetReservationsQuery(date, tableId, status, customerId, page, pageSize);
        var result = await _mediator.SendQuery(query);
        return Ok(result);
    }

    /// <summary>
    /// Get available time slots for a specific date and number of guests
    /// </summary>
    [HttpGet("available-slots")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<AvailableTimeSlotsDto>>> GetAvailableTimeSlots(
        [FromQuery] DateTime date,
        [FromQuery] int numberOfGuests)
    {
        if (numberOfGuests <= 0)
        {
            return BadRequest(ApiResponse<AvailableTimeSlotsDto>.Failure("Number of guests must be greater than 0"));
        }

        var query = new GetAvailableTimeSlotsQuery(date, numberOfGuests);
        var result = await _mediator.SendQuery(query);
        return Ok(result);
    }

    /// <summary>
    /// Create a new reservation
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<ReservationDto>>> CreateReservation([FromBody] CreateReservationDto reservationData)
    {
        Guid? customerId = null;

        // If user is authenticated, use their ID
        if (User.Identity?.IsAuthenticated == true)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (Guid.TryParse(userIdClaim, out var userId))
            {
                customerId = userId;
            }
        }

        var command = new CreateReservationCommand(reservationData, customerId);
        var result = await _mediator.SendCommand(command);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Update a reservation (Admin only)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<ReservationDto>>> UpdateReservation(Guid id, [FromBody] UpdateReservationDto reservationData)
    {
        var command = new UpdateReservationCommand(id, reservationData);
        var result = await _mediator.SendCommand(command);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Cancel a reservation
    /// </summary>
    [HttpPost("{id}/cancel")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<bool>>> CancelReservation(Guid id)
    {
        // TODO: Add authorization check - users can only cancel their own reservations (except admins)

        var command = new CancelReservationCommand(id);
        var result = await _mediator.SendCommand(command);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Confirm a reservation (Admin only)
    /// </summary>
    [HttpPost("{id}/confirm")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> ConfirmReservation(Guid id)
    {
        var command = new ConfirmReservationCommand(id);
        var result = await _mediator.SendCommand(command);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Delete a reservation permanently (Admin only)
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<bool>>> DeleteReservation(Guid id)
    {
        var command = new DeleteReservationCommand(id);
        var result = await _mediator.SendCommand(command);

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Quick approve reservation from email link
    /// </summary>
    [HttpGet("{id}/quick-approve")]
    [AllowAnonymous]
    public async Task<IActionResult> QuickApprove(Guid id)
    {
        try
        {
            var command = new ConfirmReservationCommand(id);
            var result = await _mediator.SendCommand(command);

            if (result.Success)
            {
                return Content($@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Reservation Approved</title>
    <style>
        body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }}
        .container {{ text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; }}
        .success-icon {{ font-size: 64px; margin-bottom: 20px; }}
        h1 {{ color: #10b981; margin-bottom: 10px; }}
        p {{ color: #6b7280; margin: 10px 0; }}
        .details {{ background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: left; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='success-icon'>✓</div>
        <h1>Reservation Approved!</h1>
        <p>The reservation has been successfully approved.</p>
        <div class='details'>
            <p><strong>Reservation ID:</strong> {id}</p>
            <p>The customer has been automatically notified via email.</p>
        </div>
        <p style='margin-top: 20px;'><a href='javascript:window.close()'>Close this window</a></p>
    </div>
</body>
</html>", "text/html");
            }

            return Content($@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Error</title>
    <style>
        body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }}
        .container {{ text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; }}
        .error-icon {{ font-size: 64px; margin-bottom: 20px; }}
        h1 {{ color: #dc2626; margin-bottom: 10px; }}
        p {{ color: #6b7280; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='error-icon'>✕</div>
        <h1>Error</h1>
        <p>{result.Message ?? "Failed to approve reservation"}</p>
        <p style='margin-top: 20px;'><a href='javascript:window.close()'>Close this window</a></p>
    </div>
</body>
</html>", "text/html");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error approving reservation {ReservationId}", id);
            return Content($@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Error</title>
    <style>
        body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }}
        .container {{ text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; }}
        .error-icon {{ font-size: 64px; margin-bottom: 20px; }}
        h1 {{ color: #dc2626; margin-bottom: 10px; }}
        p {{ color: #6b7280; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='error-icon'>✕</div>
        <h1>Error</h1>
        <p>An unexpected error occurred</p>
        <p style='margin-top: 20px;'><a href='javascript:window.close()'>Close this window</a></p>
    </div>
</body>
</html>", "text/html");
        }
    }

    /// <summary>
    /// Quick reject reservation from email link
    /// </summary>
    [HttpGet("{id}/quick-reject")]
    [AllowAnonymous]
    public async Task<IActionResult> QuickReject(Guid id)
    {
        try
        {
            var command = new CancelReservationCommand(id);
            var result = await _mediator.SendCommand(command);

            if (result.Success)
            {
                // TODO: Send rejection email to customer using EmailTemplates.ReservationRejected
                // This will require fetching reservation details and customer email
                _logger.LogInformation("Reservation {ReservationId} rejected via email action", id);

                return Content($@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Reservation Rejected</title>
    <style>
        body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }}
        .container {{ text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; }}
        .warning-icon {{ font-size: 64px; margin-bottom: 20px; }}
        h1 {{ color: #dc2626; margin-bottom: 10px; }}
        p {{ color: #6b7280; margin: 10px 0; }}
        .details {{ background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 20px; text-align: left; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='warning-icon'>✕</div>
        <h1>Reservation Rejected</h1>
        <p>The reservation has been rejected.</p>
        <div class='details'>
            <p><strong>Reservation ID:</strong> {id}</p>
            <p>The customer will be notified via email.</p>
        </div>
        <p style='margin-top: 20px;'><a href='javascript:window.close()'>Close this window</a></p>
    </div>
</body>
</html>", "text/html");
            }

            return Content($@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Error</title>
    <style>
        body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }}
        .container {{ text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; }}
        .error-icon {{ font-size: 64px; margin-bottom: 20px; }}
        h1 {{ color: #dc2626; margin-bottom: 10px; }}
        p {{ color: #6b7280; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='error-icon'>✕</div>
        <h1>Error</h1>
        <p>{result.Message ?? "Failed to reject reservation"}</p>
        <p style='margin-top: 20px;'><a href='javascript:window.close()'>Close this window</a></p>
    </div>
</body>
</html>", "text/html");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rejecting reservation {ReservationId}", id);
            return Content($@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Error</title>
    <style>
        body {{ font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f3f4f6; }}
        .container {{ text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; }}
        .error-icon {{ font-size: 64px; margin-bottom: 20px; }}
        h1 {{ color: #dc2626; margin-bottom: 10px; }}
        p {{ color: #6b7280; }}
    </style>
</head>
<body>
    <div class='container'>
        <div class='error-icon'>✕</div>
        <h1>Error</h1>
        <p>An unexpected error occurred</p>
        <p style='margin-top: 20px;'><a href='javascript:window.close()'>Close this window</a></p>
    </div>
</body>
</html>", "text/html");
        }
    }
}
