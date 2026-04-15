import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'statusNota',
  standalone: true
})
export class StatusNotaPipe implements PipeTransform {
  transform(status: string): string {
    const statusMap: { [key: string]: string } = {
      'ABERTA': '🟠 Aberta',
      'IMPRESSA': '🟢 Fechada',
      'CANCELADA': '🔴 Cancelada'
    };
    
    return statusMap[status] || status;
  }
}
